import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router";
import {
  fetchProductBySlug,
  fetchRelatedProducts,
  getApprovedReviews,
  submitReview,
} from "../services/storeService";
import { useSettings } from "../context/SettingsContext";
import { supabase } from "../lib/supabase";
import { ProductCard } from "../components/ProductCard";
import { ProductDetailSkeleton } from "../components/Skeletons";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import {
  getUnitPrice,
  getNextTier,
  getTierRanges,
  type Product,
  type Review,
} from "@urbanrat/shared";
import {
  ArrowLeft,
  ShieldCheck,
  Truck,
  RotateCcw,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Star,
  Send,
  Layers,
} from "lucide-react";
import { QuantityInput } from "../components/QuantityInput";
import { triggerHaptic } from "../utils/haptics";

interface ProductDetailPageProps {
  onAddToCart: (product: Product, quantity: number) => void;
}

export function ProductDetailPage({ onAddToCart }: ProductDetailPageProps) {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { whatsappNumber } = useSettings();

  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [addedToast, setAddedToast] = useState(false);

  // Reviews state
  const [reviews, setReviews] = useState<Review[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Swipe support for mobile gallery
  const touchStartX = useRef<number | null>(null);

  const loadProductData = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    setActiveImageIndex(0);

    try {
      const prod = await fetchProductBySlug(slug);
      setProduct(prod);
      if (prod) {
        setQuantity(prod.min_order_qty || 1);
        const [related, approvedRevs, authRes] = await Promise.all([
          fetchRelatedProducts(prod.id, prod.category_id).catch(() => []),
          getApprovedReviews(prod.id).catch(() => []),
          supabase.auth.getUser().catch(() => ({ data: { user: null } })),
        ]);
        setRelatedProducts(related);
        setReviews(approvedRevs);
        setCurrentUser(authRes.data.user);
      }
    } catch (err: any) {
      console.error("Failed to load product detail:", err);
      setError(err?.message || "Failed to load product details.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadProductData();
  }, [loadProductData]);

  if (loading) {
    return (
      <div className="space-y-6 pb-12 animate-in fade-in duration-300">
        <div className="h-4 w-16 bg-slate-100 rounded" />
        <ProductDetailSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8">
        <ErrorState
          title="Could not load product"
          message={error}
          onRetry={loadProductData}
        />
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

  const tiers = product.price_tiers || [];
  const minQty = product.min_order_qty || 1;
  const step = product.order_qty_step || 1;
  const stock = product.stock;

  // Tier pricing calculations
  const unitPrice = getUnitPrice(tiers, quantity);
  const estimatedLineTotal = unitPrice * quantity;
  const nextTier = getNextTier(tiers, quantity);
  const tierRangeLabels = getTierRanges(tiers);
  const firstTierPrice = tiers[0]?.unit_price ?? product.price;

  const images =
    product.images.length > 0
      ? product.images
      : [
          "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=800&auto=format&fit=crop&q=80",
        ];

  const discountPercent =
    product.mrp && product.mrp > unitPrice
      ? Math.round(((product.mrp - unitPrice) / product.mrp) * 100)
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
        setActiveImageIndex((prev) => (prev + 1) % images.length);
      } else {
        setActiveImageIndex((prev) => (prev - 1 + images.length) % images.length);
      }
    }
    touchStartX.current = null;
  }

  function handleSelectTier(tierMinQty: number) {
    if (stock <= 0) return;
    let target = Math.max(tierMinQty, minQty);

    if (step > 1) {
      const remainder = (target - minQty) % step;
      if (remainder !== 0) {
        target = target + (step - remainder);
      }
    }

    if (stock > 0 && target > stock) {
      target = stock;
    }

    triggerHaptic("selection");
    setQuantity(target);
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

  async function handleReviewSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!product || !currentUser) return;
    setSubmittingReview(true);
    setReviewError(null);
    try {
      await submitReview({
        productId: product.id,
        rating: reviewRating,
        title: reviewTitle.trim() || undefined,
        body: reviewBody.trim() || undefined,
      });
      setReviewSuccess(true);
      setReviewTitle("");
      setReviewBody("");
    } catch (err: any) {
      setReviewError(err?.message || "Failed to submit review.");
    } finally {
      setSubmittingReview(false);
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300 pb-16 -mt-4 sm:mt-0">
      {/* ── Breadcrumb / Back Navigation ── */}
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
              <div className="absolute top-4 left-4 z-10 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/95 backdrop-blur-md text-brand-dark border border-slate-200/60 shadow-xs flex items-center space-x-1.5">
                <img
                  src="/logo.png"
                  alt="Urbanrat"
                  className="w-3.5 h-3.5 rounded-full object-cover"
                />
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
                      ? "border-brand-dark shadow-xs ring-2 ring-brand-light/40"
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

            {/* Rating Stars (Only shown if rating_count > 0) */}
            {Boolean(product.rating_count && product.rating_count > 0) && (
              <div className="flex items-center space-x-2 mb-1.5">
                <div className="flex items-center text-amber-400">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3.5 h-3.5 ${
                        i < Math.round(Number(product.rating_avg) || 0)
                          ? "fill-amber-400 text-amber-400"
                          : "text-slate-200"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs font-black text-slate-800">
                  {Number(product.rating_avg).toFixed(1)}
                </span>
                <span className="text-xs text-slate-400">
                  ({product.rating_count}{" "}
                  {product.rating_count === 1 ? "review" : "reviews"})
                </span>
              </div>
            )}

            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight leading-snug">
              {product.name}
            </h1>

            {product.short_description && (
              <p className="mt-1 text-xs sm:text-sm font-medium text-slate-600">
                {product.short_description}
              </p>
            )}

            {product.description && (
              <p className="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed">
                {product.description}
              </p>
            )}

            {/* Warranty Badge */}
            {Boolean(product.warranty_months && product.warranty_months > 0) && (
              <div className="mt-3 inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{product.warranty_months} Months Wholesale Warranty</span>
              </div>
            )}
          </div>

          {/* ── Bulk Pricing Table ── */}
          {tiers.length > 0 && (
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-brand-dark" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Tiered Volume Pricing
                  </h3>
                </div>
                <span className="text-[10px] text-slate-400 font-semibold">
                  Unit Price per Piece
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {tiers.map((tier, idx) => {
                  const rangeStr = tierRangeLabels[idx] || `${tier.min_qty}+`;
                  const isFirstTier = idx === 0;
                  const savingsVsFirst =
                    !isFirstTier && firstTierPrice > tier.unit_price
                      ? Math.round(
                          ((firstTierPrice - tier.unit_price) / firstTierPrice) * 100
                        )
                      : 0;

                  // Active tier logic based on current quantity
                  const isActive =
                    quantity >= tier.min_qty &&
                    (idx === tiers.length - 1 || quantity < tiers[idx + 1]!.min_qty);

                  const isUnavailable = stock > 0 && tier.min_qty > stock;

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectTier(tier.min_qty)}
                      disabled={isUnavailable || stock <= 0}
                      aria-pressed={isActive}
                      aria-label={`Select ${rangeStr} pieces tier at ₹${tier.unit_price} each`}
                      className={`relative rounded-2xl p-3 border transition-all text-left w-full cursor-pointer select-none group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/50 disabled:opacity-50 disabled:cursor-not-allowed ${
                        isActive
                          ? "bg-sky-50/80 border-brand-dark ring-2 ring-brand-light/40 shadow-xs"
                          : "bg-slate-50/60 border-slate-100 hover:bg-sky-50/40 hover:border-brand-light/60 active:scale-[0.98]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1 gap-1">
                        <span
                          className={`text-[11px] font-extrabold ${
                            isActive
                              ? "text-brand-dark font-black"
                              : "text-slate-600 group-hover:text-slate-900"
                          }`}
                        >
                          {rangeStr} pcs
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {savingsVsFirst > 0 && (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-emerald-100 text-emerald-800">
                              Save {savingsVsFirst}%
                            </span>
                          )}
                          {isActive && (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-brand-dark text-white shadow-2xs">
                              Active
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-base font-black text-slate-900 tracking-tight">
                        ₹{tier.unit_price.toLocaleString("en-IN")}
                        <span className="text-[10px] text-slate-400 font-medium ml-0.5">
                          /pc
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pricing Box & Quantity Stepper */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-xs space-y-4">
            <div className="flex items-baseline space-x-2.5">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                ₹{unitPrice.toLocaleString("en-IN")}
              </span>
              <span className="text-xs text-slate-400 font-medium">/ unit</span>

              {product.mrp && product.mrp > unitPrice && (
                <span className="text-sm text-slate-400 line-through">
                  ₹{product.mrp.toLocaleString("en-IN")}
                </span>
              )}
            </div>

            {/* Stock Status Indicator */}
            <div className="flex items-center space-x-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  stock > (product.low_stock_threshold || 10)
                    ? "bg-emerald-500"
                    : stock > 0
                    ? "bg-amber-500"
                    : "bg-rose-500"
                }`}
              />
              <span className="text-xs font-bold text-slate-700">
                {stock > (product.low_stock_threshold || 10)
                  ? `In Stock (${stock} units ready to ship)`
                  : stock > 0
                  ? `Low Stock (${stock} units remaining)`
                  : "Out of Stock"}
              </span>
            </div>

            {/* Quantity Stepper respecting min_order_qty, order_qty_step and stock */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">
                  Quantity (Min: {minQty}
                  {step > 1 ? `, Step: ${step}` : ""})
                </span>

                <QuantityInput
                  value={quantity}
                  onChange={setQuantity}
                  min={minQty}
                  max={stock > 0 ? stock : undefined}
                  step={step}
                  size="md"
                  disabled={stock === 0}
                  ariaLabel="Order quantity"
                />
              </div>

              {/* Live Line Total Math (clearly labeled as an estimate) */}
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-slate-500 font-medium">
                  Estimated Subtotal:
                </span>
                <div className="text-right">
                  <span className="text-slate-900 font-black text-sm">
                    ₹{estimatedLineTotal.toLocaleString("en-IN")}
                  </span>
                  <span className="ml-1 text-[10px] text-slate-400 font-normal">
                    (estimated)
                  </span>
                </div>
              </div>

              {/* Nudge: Add N more to get tier price */}
              {nextTier && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => handleSelectTier(nextTier.tier.min_qty)}
                    className="w-full text-left p-2.5 rounded-xl bg-sky-50 hover:bg-sky-100/70 border border-sky-100 text-[11px] font-semibold text-sky-800 flex items-center justify-between transition-colors cursor-pointer group"
                    aria-label={`Add ${nextTier.piecesNeeded} more to reach ${nextTier.tier.min_qty} pieces tier at ₹${nextTier.tier.unit_price} each`}
                  >
                    <div className="flex items-center space-x-1.5">
                      <span className="text-sm">💡</span>
                      <span>
                        Add <strong>{nextTier.piecesNeeded} more</strong> to get{" "}
                        <strong>
                          ₹{nextTier.tier.unit_price.toLocaleString("en-IN")}/pc
                        </strong>
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-brand-dark underline underline-offset-2 opacity-80 group-hover:opacity-100 shrink-0 ml-2">
                      Apply
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons: Add to Cart & Buy Now */}
          <div className="space-y-2.5">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={stock <= 0}
                className="flex-1 py-3.5 px-6 rounded-2xl text-white font-bold text-xs sm:text-sm shadow-md hover:shadow-lg active:scale-95 transition-all cursor-pointer flex items-center justify-center space-x-1.5 disabled:opacity-50"
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
                disabled={stock <= 0}
                className="flex-1 py-3.5 px-6 rounded-2xl bg-slate-900 hover:bg-black text-white font-bold text-xs sm:text-sm shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                Buy Now
              </button>
            </div>

            {/* WhatsApp Inquiry (Only if whatsappNumber exists) */}
            {whatsappNumber && (
              <a
                href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
                  `Hi URT Wholesale, I am interested in wholesale order: ${product.name} (SKU: ${
                    product.sku || "N/A"
                  }). Estimate: ₹${estimatedLineTotal} for ${quantity} pcs.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center space-x-2 py-3 px-5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-200/80 transition"
              >
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                <span>Direct WhatsApp Inquiry / Bulk Quote</span>
              </a>
            )}
          </div>

          {/* Technical Specs Grid from specs jsonb */}
          {product.specs && Object.keys(product.specs).length > 0 && (
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-xs space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                Specifications
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {Object.entries(product.specs).map(([key, val]) => (
                  <div
                    key={key}
                    className="flex justify-between py-2 px-3 rounded-xl bg-slate-50 border border-slate-100/60"
                  >
                    <span className="font-semibold text-slate-500 capitalize">
                      {key.replace(/_/g, " ")}
                    </span>
                    <span className="font-bold text-slate-900 text-right">
                      {String(val)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Guarantees */}
          <div className="grid grid-cols-3 gap-2 pt-2 text-center text-slate-600 text-[11px]">
            <div className="bg-white p-2.5 rounded-2xl border border-slate-100">
              <Truck className="w-4 h-4 text-brand-dark mx-auto mb-1" />
              <span className="font-semibold">Fast Shipping</span>
            </div>
            <div className="bg-white p-2.5 rounded-2xl border border-slate-100">
              <ShieldCheck className="w-4 h-4 text-brand-dark mx-auto mb-1" />
              <span className="font-semibold">QA Tested</span>
            </div>
            <div className="bg-white p-2.5 rounded-2xl border border-slate-100">
              <RotateCcw className="w-4 h-4 text-brand-dark mx-auto mb-1" />
              <span className="font-semibold">DOA Guarantee</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Customer Reviews & Ratings ── */}
      <section className="pt-8 border-t border-slate-100 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Customer Reviews
            </h2>
            <p className="text-xs text-slate-400">
              Verified wholesale buyer feedback
            </p>
          </div>
          {Boolean(product.rating_count && product.rating_count > 0) && (
            <div className="text-right">
              <span className="text-lg font-black text-slate-900">
                {Number(product.rating_avg).toFixed(1)}
              </span>
              <span className="text-xs text-slate-400 font-medium"> / 5.0</span>
            </div>
          )}
        </div>

        {/* Approved Reviews List */}
        {reviews.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {reviews.map((rev) => (
              <div
                key={rev.id}
                className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-amber-400">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${
                          i < rev.rating
                            ? "fill-amber-400 text-amber-400"
                            : "text-slate-200"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {new Date(rev.created_at).toLocaleDateString()}
                  </span>
                </div>
                {rev.title && (
                  <h4 className="text-xs font-bold text-slate-900">{rev.title}</h4>
                )}
                {rev.body && (
                  <p className="text-xs text-slate-600 leading-relaxed font-normal">
                    {rev.body}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white p-5 rounded-2xl border border-slate-100 text-center text-xs text-slate-500">
            No approved reviews yet. Verified buyers can submit feedback below!
          </div>
        )}

        {/* Write a Review Section */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs space-y-3">
          <h3 className="text-sm font-extrabold text-slate-800">
            Write a Wholesale Review
          </h3>

          {currentUser ? (
            reviewSuccess ? (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Thank you! Your review has been submitted and will appear once approved by moderation.
                </span>
              </div>
            ) : (
              <form onSubmit={handleReviewSubmit} className="space-y-3">
                {reviewError && (
                  <p className="text-xs text-rose-600 font-semibold">
                    {reviewError}
                  </p>
                )}

                {/* Rating Stars Input */}
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-700">Rating:</span>
                  <div className="flex items-center space-x-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewRating(star)}
                        className="p-1 cursor-pointer focus:outline-none"
                      >
                        <Star
                          className={`w-5 h-5 ${
                            star <= reviewRating
                              ? "fill-amber-400 text-amber-400"
                              : "text-slate-300"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <input
                    type="text"
                    value={reviewTitle}
                    onChange={(e) => setReviewTitle(e.target.value)}
                    placeholder="Review headline (optional)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-brand-light focus:outline-none"
                  />
                </div>

                <div>
                  <textarea
                    value={reviewBody}
                    onChange={(e) => setReviewBody(e.target.value)}
                    rows={3}
                    placeholder="Share your experience regarding build quality, margins, or packaging..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-brand-light focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingReview}
                  className="px-5 py-2.5 rounded-xl text-white font-bold text-xs shadow hover:shadow-md active:scale-95 transition disabled:opacity-50 cursor-pointer flex items-center space-x-1.5"
                  style={{
                    background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)",
                  }}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {submittingReview ? "Submitting..." : "Submit Review"}
                  </span>
                </button>
              </form>
            )
          ) : (
            <p className="text-xs text-slate-500">
              Please{" "}
              <Link to="/menu" className="font-bold text-brand-dark underline">
                sign in to your customer account
              </Link>{" "}
              to write a review.
            </p>
          )}
        </div>
      </section>

      {/* ── Related Products Row ── */}
      {relatedProducts.length > 0 && (
        <section className="pt-8 border-t border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Related Accessories
            </h2>
            <Link
              to="/marketplace"
              className="text-xs font-bold text-brand-dark hover:underline"
            >
              View All →
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-5">
            {relatedProducts.map((rel) => (
              <ProductCard
                key={rel.id}
                product={rel}
                onAddToCart={(p) => onAddToCart(p, p.min_order_qty || 1)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
