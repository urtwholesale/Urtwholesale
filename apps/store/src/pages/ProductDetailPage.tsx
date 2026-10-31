import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router";
import {
  fetchProductBySlug,
  fetchRelatedProducts,
  fetchSimilarProducts,
  fetchCatalogProducts,
  fetchCategories,
  getApprovedReviews,
  submitReview,
} from "../services/storeService";
import { recordRecentlyViewed } from "../services/recentViews";
import { ProductCatalogNav } from "../components/ProductCatalogNav";
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
  getProductColors,
  isColorSelectionEnabled,
  getColorHex,
  type Product,
  type Review,
  type Category,
} from "@urbanrat/shared";
import {
  ShieldCheck,
  Truck,
  RotateCcw,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Star,
  Send,
  PenLine,
  X,
  Layers,
  Lightbulb,
  Palette,
} from "lucide-react";
import { QuantityInput } from "../components/QuantityInput";
import { triggerHaptic } from "../utils/haptics";

function formatCount(num: number): string {
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  }
  return String(num);
}

interface ProductDetailPageProps {
  onAddToCart: (product: Product, quantity: number, selectedColor?: string) => void;
}

export function ProductDetailPage({ onAddToCart }: ProductDetailPageProps) {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { whatsappNumber } = useSettings();

  const [product, setProduct] = useState<Product | null>(null);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [categoryName, setCategoryName] = useState<string>("Catalog");
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [addedToast, setAddedToast] = useState(false);

  // Selective Color Variants
  const availableColors = useMemo(() => {
    if (!product) return [];
    return isColorSelectionEnabled(product) ? getProductColors(product) : [];
  }, [product]);

  const [selectedColor, setSelectedColor] = useState<string>("");

  useEffect(() => {
    if (availableColors.length > 0) {
      setSelectedColor(availableColors[0] || "");
    } else {
      setSelectedColor("");
    }
  }, [availableColors]);

  // Reviews state
  const [reviews, setReviews] = useState<Review[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewAuthor, setReviewAuthor] = useState(() => {
    try {
      const savedCust = localStorage.getItem("urt_customer_details");
      if (savedCust) {
        const parsed = JSON.parse(savedCust);
        return parsed.name || "";
      }
    } catch {}
    return "";
  });
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [selectedStarFilter, setSelectedStarFilter] = useState<number | null>(null);

  // Derived ratings breakdown strictly based on real customer reviews
  const totalRatingsCount = useMemo(() => {
    if (reviews.length > 0) return reviews.length;
    if (product?.rating_count && product.rating_count > 0) return product.rating_count;
    return 0;
  }, [reviews, product?.rating_count]);

  const numericAvgScore = useMemo(() => {
    if (reviews.length > 0) {
      const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
      return Math.round((sum / reviews.length) * 10) / 10;
    }
    if (product?.rating_avg && Number(product.rating_avg) > 0) {
      return Math.round(Number(product.rating_avg) * 10) / 10;
    }
    return 0;
  }, [reviews, product?.rating_avg]);

  const avgScore = numericAvgScore > 0 ? numericAvgScore.toFixed(1) : "0.0";

  const ratingBreakdown = useMemo(() => {
    const counts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const r of reviews) {
      const star = Number(r.rating);
      if (star in counts) {
        counts[star] = (counts[star] || 0) + 1;
      }
    }

    const total = reviews.length;
    return [
      {
        star: 5,
        label: "FIVE",
        count: counts[5] || 0,
        pct: total > 0 ? Math.round(((counts[5] || 0) / total) * 100) : 0,
      },
      {
        star: 4,
        label: "FOUR",
        count: counts[4] || 0,
        pct: total > 0 ? Math.round(((counts[4] || 0) / total) * 100) : 0,
      },
      {
        star: 3,
        label: "THREE",
        count: counts[3] || 0,
        pct: total > 0 ? Math.round(((counts[3] || 0) / total) * 100) : 0,
      },
      {
        star: 2,
        label: "TWO",
        count: counts[2] || 0,
        pct: total > 0 ? Math.round(((counts[2] || 0) / total) * 100) : 0,
      },
      {
        star: 1,
        label: "ONE",
        count: counts[1] || 0,
        pct: total > 0 ? Math.round(((counts[1] || 0) / total) * 100) : 0,
      },
    ];
  }, [reviews]);

  const displayedReviews = useMemo(() => {
    if (selectedStarFilter === null) return reviews;
    return reviews.filter((r) => r.rating === selectedStarFilter);
  }, [reviews, selectedStarFilter]);

  // Memoized category helpers for Related Accessories display & breadcrumbs
  const currentCategory = useMemo(() => {
    if (!product?.category_id || !allCategories.length) return null;
    return allCategories.find((c) => c.id === product.category_id) || null;
  }, [product?.category_id, allCategories]);

  const parentCategory = useMemo(() => {
    if (!currentCategory?.parent_id || !allCategories.length) return null;
    return allCategories.find((c) => c.id === currentCategory.parent_id) || null;
  }, [currentCategory?.parent_id, allCategories]);

  const displayCategoryName = useMemo(() => {
    return parentCategory?.name || currentCategory?.name || categoryName || "Accessories";
  }, [parentCategory, currentCategory, categoryName]);

  const categoryMarketplaceUrl = useMemo(() => {
    if (parentCategory) {
      return `/marketplace?category=${parentCategory.slug}`;
    }
    if (currentCategory) {
      return `/marketplace?category=${currentCategory.slug}`;
    }
    return "/marketplace";
  }, [parentCategory, currentCategory]);

  const displayedRelatedProducts = useMemo(() => {
    const simIds = new Set(similarProducts.map((s) => s.id));
    return relatedProducts.filter((r) => !simIds.has(r.id) && r.id !== product?.id);
  }, [relatedProducts, similarProducts, product?.id]);

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
        recordRecentlyViewed(prod);
        setQuantity(prod.min_order_qty || 1);

        // Fetch categories first to construct category family for related accessories
        const [cats, approvedRevs, authRes] = await Promise.all([
          fetchCategories().catch(() => []),
          getApprovedReviews(prod.id).catch(() => []),
          supabase.auth.getUser().catch(() => ({ data: { user: null } })),
        ]);
        setAllCategories(cats);

        const curCat = cats.find((c) => c.id === prod.category_id);
        const parCat = curCat?.parent_id ? cats.find((c) => c.id === curCat.parent_id) : null;
        setCategoryName(parCat?.name || curCat?.name || "Catalog");

        // Build category family IDs (exact category, parent, siblings, and child categories)
        const familyCatIds: string[] = [];
        if (curCat) {
          familyCatIds.push(curCat.id);
          if (curCat.parent_id) {
            familyCatIds.push(curCat.parent_id);
            cats.filter((c) => c.parent_id === curCat.parent_id).forEach((c) => familyCatIds.push(c.id));
          } else {
            cats.filter((c) => c.parent_id === curCat.id).forEach((c) => familyCatIds.push(c.id));
          }
        }

        const [similar, related, catalogItems] = await Promise.all([
          fetchSimilarProducts(prod).catch(() => []),
          fetchRelatedProducts(prod.id, prod.category_id, familyCatIds, 8).catch(() => []),
          prod.category_id ? fetchCatalogProducts(prod.category_id).catch(() => []) : Promise.resolve([]),
        ]);
        setSimilarProducts(similar);
        setRelatedProducts(related);

        // Populate catalog siblings: if catalogItems returned list, use it; otherwise fallback to prod + related
        if (catalogItems.length > 0) {
          setCatalogProducts(catalogItems);
        } else if (related.length > 0) {
          setCatalogProducts([prod, ...related]);
        } else if (similar.length > 0) {
          setCatalogProducts([prod, ...similar]);
        } else {
          setCatalogProducts([prod]);
        }

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
    onAddToCart(product, quantity, selectedColor || undefined);
    setAddedToast(true);
    setTimeout(() => setAddedToast(false), 2200);
  }

  function handleBuyNow() {
    if (!product) return;
    triggerHaptic("medium");
    onAddToCart(product, quantity, selectedColor || undefined);
    navigate("/cart");
  }

  async function handleReviewSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!product) return;
    setSubmittingReview(true);
    setReviewError(null);
    try {
      const author =
        reviewAuthor.trim() ||
        currentUser?.user_metadata?.full_name ||
        currentUser?.email?.split("@")[0] ||
        "Verified Wholesale Buyer";

      const newReview = await submitReview({
        productId: product.id,
        rating: reviewRating,
        title: reviewTitle.trim() || undefined,
        body: reviewBody.trim() || undefined,
        authorName: author,
      });
      if (newReview) {
        setReviews((prev) => [newReview, ...prev.filter((r) => r.id !== newReview.id)]);
      }
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
      {/* ── Symmetrical Product Catalog Navigation & Quick-Switch Hub ── */}
      <ProductCatalogNav
        currentProduct={product}
        catalogProducts={catalogProducts}
        categoryName={categoryName}
        allCategories={allCategories}
        onSelectProduct={(targetSlug) => {
          navigate(`/product/${targetSlug}`);
        }}
        onBack={() => {
          if (window.history.state && window.history.state.idx > 0) {
            navigate(-1);
          } else {
            navigate("/marketplace");
          }
        }}
      />

      {/* ── Main Showcase Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 xl:gap-14 items-start">
        {/* Left: Gallery with Swipe & Thumbnails */}
        <div className="space-y-3 lg:col-span-5 xl:col-span-5">
          <div
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="relative aspect-square sm:rounded-3xl overflow-hidden bg-white dark:bg-slate-900 sm:border sm:border-slate-100 dark:sm:border-slate-800 sm:shadow-xs flex items-center justify-center p-0 group select-none -mx-4 sm:mx-0 border-b border-slate-100 dark:border-slate-800 sm:border-b-0"
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
              <div className="absolute top-4 left-4 z-10 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/95 dark:bg-slate-800/95 backdrop-blur-md text-brand-dark dark:text-brand-light border border-slate-200/60 dark:border-slate-700/60 shadow-xs flex items-center space-x-1.5">
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
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/90 dark:bg-slate-800/90 shadow-md flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-750 active:scale-90 transition opacity-80 group-hover:opacity-100 cursor-pointer border border-slate-200/50 dark:border-white/10"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label="Next image"
                  onClick={() =>
                    setActiveImageIndex((prev) => (prev + 1) % images.length)
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/90 dark:bg-slate-800/90 shadow-md flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-750 active:scale-90 transition opacity-80 group-hover:opacity-100 cursor-pointer border border-slate-200/50 dark:border-white/10"
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
                  className={`w-14 h-14 rounded-2xl overflow-hidden border-2 bg-white dark:bg-slate-800 transition cursor-pointer shrink-0 ${
                    activeImageIndex === idx
                      ? "border-brand-dark shadow-xs ring-2 ring-brand-light/40"
                      : "border-slate-200/80 dark:border-slate-700 opacity-70 hover:opacity-100"
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
              <span className="text-[11px] font-mono text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-100 dark:border-slate-700 shadow-2xs">
                SKU: {product.sku || "UR-ACCESSORY"}
              </span>
            </div>

            {/* Rating Stars (Strictly driven by actual customer reviews) */}
            {totalRatingsCount > 0 && (
              <div className="flex items-center space-x-2 mb-1.5">
                <div className="flex items-center text-amber-400">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3.5 h-3.5 ${
                        i < Math.round(numericAvgScore)
                          ? "fill-amber-400 text-amber-400"
                          : "text-slate-200 dark:text-slate-700"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                  {avgScore}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  ({totalRatingsCount}{" "}
                  {totalRatingsCount === 1 ? "review" : "reviews"})
                </span>
              </div>
            )}

            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-snug">
              {product.name}
            </h1>

            {product.short_description && (
              <p className="mt-1 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300">
                {product.short_description}
              </p>
            )}

            {/* Warranty Badge */}
            {Boolean(product.warranty_months && product.warranty_months > 0) && (
              <div className="mt-3 inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/40">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{product.warranty_months} Months Wholesale Warranty</span>
              </div>
            )}
          </div>

          {/* ── Bulk Pricing Table ── */}
          {tiers.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border border-slate-100 dark:border-slate-800 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-brand-dark dark:text-brand-light" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
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
                          ? "bg-sky-50/80 dark:bg-orange-950/30 border-brand-dark dark:border-orange-500 ring-2 ring-brand-light/40 dark:ring-orange-500/40 shadow-xs"
                          : "bg-slate-50/60 dark:bg-slate-800/60 border-slate-100 dark:border-slate-800 hover:bg-sky-50/40 dark:hover:bg-orange-950/20 hover:border-brand-light/60 dark:hover:border-orange-500/60 active:scale-[0.98]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1 gap-1">
                        <span
                          className={`text-[11px] font-extrabold ${
                            isActive
                              ? "text-brand-dark dark:text-brand-light font-black"
                              : "text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white"
                          }`}
                        >
                          {rangeStr} pcs
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {savingsVsFirst > 0 && (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400">
                              Save {savingsVsFirst}%
                            </span>
                          )}
                          {isActive && (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-brand-dark dark:bg-brand text-white shadow-2xs">
                              Active
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-base font-black text-slate-900 dark:text-white tracking-tight">
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
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border border-slate-100 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-baseline space-x-2.5">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
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
                  stock > 0 ? "bg-emerald-500" : "bg-rose-500"
                }`}
              />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {stock > 0 ? "In Stock" : "Out of Stock"}
              </span>
            </div>

            {/* Selective Color Options (Only when enabled for this catalog) */}
            {availableColors.length > 0 && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                    <Palette className="w-3.5 h-3.5 text-brand-dark dark:text-brand-light" />
                    <span>Select Color:</span>
                  </span>
                  {selectedColor && (
                    <span className="text-[11px] font-black text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                      {selectedColor}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 pt-0.5">
                  {availableColors.map((color: string) => {
                    const isSelected = selectedColor.toLowerCase() === color.toLowerCase();
                    const hex = getColorHex(color);
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => {
                          triggerHaptic("selection");
                          setSelectedColor(color);
                        }}
                        className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? "bg-sky-50 dark:bg-orange-950/40 text-sky-950 dark:text-orange-200 border-brand-dark dark:border-orange-500 ring-2 ring-brand-light/50 dark:ring-orange-500/40 shadow-xs"
                            : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60"
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/15 shadow-2xs shrink-0"
                          style={{ backgroundColor: hex }}
                        />
                        <span>{color}</span>
                        {isSelected && <CheckCircle2 className="w-3 h-3 text-brand-dark dark:text-brand-light ml-0.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantity Stepper respecting min_order_qty, order_qty_step and stock */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
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
                <span className="text-slate-500 dark:text-slate-400 font-medium">
                  Estimated Subtotal:
                </span>
                <div className="text-right">
                  <span className="text-slate-900 dark:text-white font-black text-sm">
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
                    className="w-full text-left p-2.5 rounded-xl bg-sky-50 dark:bg-orange-950/30 hover:bg-sky-100/70 dark:hover:bg-orange-950/50 border border-sky-100 dark:border-orange-500/30 text-[11px] font-semibold text-sky-800 dark:text-orange-200 flex items-center justify-between transition-colors cursor-pointer group"
                    aria-label={`Add ${nextTier.piecesNeeded} more to reach ${nextTier.tier.min_qty} pieces tier at ₹${nextTier.tier.unit_price} each`}
                  >
                    <div className="flex items-center space-x-1.5">
                      <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>
                        Add <strong>{nextTier.piecesNeeded} more</strong> to get{" "}
                        <strong>
                          ₹{nextTier.tier.unit_price.toLocaleString("en-IN")}/pc
                        </strong>
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-brand-dark dark:text-brand-light underline underline-offset-2 opacity-80 group-hover:opacity-100 shrink-0 ml-2">
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
                  background: "var(--brand-gradient)",
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
                className="flex-1 py-3.5 px-6 rounded-2xl bg-slate-900 dark:bg-slate-800 hover:bg-black dark:hover:bg-slate-700 text-white font-bold text-xs sm:text-sm shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50 border border-transparent dark:border-slate-700"
              >
                Buy Now
              </button>
            </div>

            {/* WhatsApp Inquiry (Only if whatsappNumber exists) */}
            {whatsappNumber && (
              <a
                href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
                  `Hi URT Wholesale, I am interested in wholesale order: ${product.name}${
                    selectedColor ? ` [Color: ${selectedColor}]` : ""
                  } (SKU: ${
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

          {/* Technical Specs Grid from specs jsonb (excluding internal color fields) */}
          {(() => {
            const displaySpecs = product.specs
              ? Object.entries(product.specs).filter(([key]) => {
                  const lower = key.toLowerCase();
                  return (
                    lower !== "colors" &&
                    lower !== "has_colors" &&
                    lower !== "colorways" &&
                    lower !== "colorway" &&
                    lower !== "color_options"
                  );
                })
              : [];
            if (displaySpecs.length === 0) return null;
            return (
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border border-slate-100 dark:border-slate-800 shadow-xs space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Specifications
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {displaySpecs.map(([key, val]) => (
                    <div
                      key={key}
                      className="flex justify-between py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100/60 dark:border-slate-700/80"
                    >
                      <span className="font-semibold text-slate-500 dark:text-slate-400 capitalize">
                        {key.replace(/_/g, " ")}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white text-right">
                        {String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Detailed Product Description (below Specifications) */}
          {product.description && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border border-slate-100 dark:border-slate-800 shadow-xs space-y-2.5">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Description
              </h3>
              <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal whitespace-pre-line">
                {product.description}
              </div>
            </div>
          )}

          {/* Guarantees */}
          <div className="grid grid-cols-3 gap-2 pt-2 text-center text-slate-600 dark:text-slate-300 text-[11px]">
            <div className="bg-white dark:bg-slate-900 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800">
              <Truck className="w-4 h-4 text-brand-dark dark:text-brand-light mx-auto mb-1" />
              <span className="font-semibold">Fast Shipping</span>
            </div>
            <div className="bg-white dark:bg-slate-900 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800">
              <ShieldCheck className="w-4 h-4 text-brand-dark dark:text-brand-light mx-auto mb-1" />
              <span className="font-semibold">QA Tested</span>
            </div>
            <div className="bg-white dark:bg-slate-900 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800">
              <RotateCcw className="w-4 h-4 text-brand-dark dark:text-brand-light mx-auto mb-1" />
              <span className="font-semibold">DOA Guarantee</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Customer Reviews & Ratings ── */}
      <section className="pt-8 border-t border-slate-100 dark:border-slate-800 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              Customer Reviews
            </h2>
            <p className="text-xs text-slate-400">
              Verified wholesale buyer feedback
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                setShowReviewForm((prev) => !prev);
              }}
              className={`inline-flex items-center space-x-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 ${
                showReviewForm
                  ? "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-750 border border-slate-300/80 dark:border-white/10"
                  : "bg-linear-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-orange-500/20 hover:shadow-md"
              }`}
            >
              {showReviewForm ? (
                <>
                  <X className="w-3.5 h-3.5" />
                  <span>Close</span>
                </>
              ) : (
                <>
                  <PenLine className="w-3.5 h-3.5" />
                  <span>Write a Review</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── When Write Review is Open: 2-Column Responsive Studio Layout (Form on Left, "Our Customer Reviews" Card on Right) ── */}
        {showReviewForm ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Left Column (lg:col-span-6 xl:col-span-6): Write a Wholesale Review Form */}
              <div className="lg:col-span-6 xl:col-span-6 bg-white dark:bg-slate-900/90 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-md space-y-3.5 transition-all">
                {/* Header: Title on Left, Stars on Right */}
                <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-slate-100 dark:border-white/5">
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                      Write a Wholesale Review
                    </h3>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      Share quality, packaging & margin feedback
                    </p>
                  </div>

                  {!reviewSuccess && (
                    <div className="flex items-center space-x-0.5 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-200/70 dark:border-slate-700/60 shadow-2xs shrink-0">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => {
                            triggerHaptic("selection");
                            setReviewRating(star);
                          }}
                          className="p-0.5 cursor-pointer hover:scale-115 active:scale-90 transition-transform"
                          title={`Rate ${star} star${star > 1 ? "s" : ""}`}
                        >
                          <Star
                            className={`w-3.5 h-3.5 ${
                              star <= reviewRating
                                ? "fill-amber-400 text-amber-400"
                                : "text-slate-300 dark:text-slate-600 hover:text-amber-300 transition-colors"
                            }`}
                          />
                        </button>
                      ))}
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 ml-1">
                        {reviewRating}.0
                      </span>
                    </div>
                  )}
                </div>

                {reviewSuccess ? (
                  <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-300 font-medium flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>
                        Thank you! Your wholesale review is now live on this product.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setReviewSuccess(false);
                        setShowReviewForm(false);
                      }}
                      className="text-emerald-700 dark:text-emerald-300 hover:underline font-bold text-xs cursor-pointer ml-3 shrink-0"
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleReviewSubmit} className="space-y-3">
                    {reviewError && (
                      <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">
                        {reviewError}
                      </p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Your Name or Store Name
                        </label>
                        <input
                          type="text"
                          value={reviewAuthor}
                          onChange={(e) => setReviewAuthor(e.target.value)}
                          placeholder="e.g. Apex Mobiles or Rajesh K."
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/50 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 dark:focus:border-orange-500 focus:outline-none transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Headline (optional)
                        </label>
                        <input
                          type="text"
                          value={reviewTitle}
                          onChange={(e) => setReviewTitle(e.target.value)}
                          placeholder="e.g. Excellent build quality & retail packaging"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/50 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 dark:focus:border-orange-500 focus:outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Detailed Review & Description
                      </label>
                      <textarea
                        value={reviewBody}
                        onChange={(e) => setReviewBody(e.target.value)}
                        rows={3}
                        placeholder="Describe build quality, durability, margins, and customer reception at your retail counter..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/50 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 dark:focus:border-orange-500 focus:outline-none resize-none transition-all"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => setShowReviewForm(false)}
                        className="px-3.5 py-1.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submittingReview}
                        className="px-4 py-2 rounded-xl text-white font-bold text-xs shadow-xs hover:shadow-md active:scale-95 transition-all disabled:opacity-50 cursor-pointer flex items-center space-x-1.5 bg-linear-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
                      >
                        <Send className="w-3 h-3" />
                        <span>{submittingReview ? "Submitting..." : "Submit Review"}</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Right Column (lg:col-span-6 xl:col-span-6): "Our Customer Reviews" Rating Breakdown Card */}
              <div className="lg:col-span-6 xl:col-span-6 bg-white dark:bg-slate-900/90 rounded-2xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-5 transition-colors">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Our Customer Reviews
                  </h3>
                  {selectedStarFilter !== null && (
                    <button
                      type="button"
                      onClick={() => setSelectedStarFilter(null)}
                      className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                    >
                      Show All
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
                  {/* Left: Star breakdown bars (FIVE, FOUR, THREE, TWO, ONE) */}
                  <div className="sm:col-span-7 space-y-2">
                    {ratingBreakdown.map((row) => {
                      const isFilterActive = selectedStarFilter === row.star;
                      const hasReviews = row.count > 0;
                      return (
                        <button
                          key={row.label}
                          type="button"
                          disabled={!hasReviews}
                          onClick={() => {
                            if (hasReviews) {
                              triggerHaptic("selection");
                              setSelectedStarFilter((prev) => (prev === row.star ? null : row.star));
                            }
                          }}
                          className={`w-full flex items-center space-x-2 text-xs py-1 px-1.5 rounded-lg transition-all text-left ${
                            isFilterActive
                              ? "bg-amber-100/70 dark:bg-amber-950/50 ring-1 ring-amber-400 font-bold"
                              : hasReviews
                              ? "hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer"
                              : "opacity-60 cursor-default"
                          }`}
                          title={
                            hasReviews
                              ? `Filter to ${row.count} ${row.label.toLowerCase()}-star review${row.count > 1 ? "s" : ""}`
                              : `No ${row.label.toLowerCase()}-star reviews yet`
                          }
                        >
                          <span className="w-12 text-[11px] font-bold text-slate-700 dark:text-slate-300 tracking-wide uppercase">
                            {row.label}
                          </span>
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                          <div className="flex-1 h-2 sm:h-2.5 rounded-full bg-amber-100/60 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-linear-to-r from-amber-400 to-amber-500 transition-all duration-500"
                              style={{ width: `${row.pct}%` }}
                            />
                          </div>
                          <span className="w-9 text-right text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                            {formatCount(row.count)}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Right: Highlight card with Big Score (Strictly derived from customer reviews), Dynamic Stars, and "{count} Ratings" */}
                  <div className="sm:col-span-5 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-2xl p-5 text-center flex flex-col items-center justify-center shadow-2xs">
                    <span className="text-3xl sm:text-4xl font-black text-amber-500 dark:text-amber-400 tracking-tight leading-none">
                      {avgScore}
                    </span>
                    <div className="flex items-center space-x-1 my-2">
                      {[1, 2, 3, 4, 5].map((i) => {
                        const isFilled = i <= Math.round(numericAvgScore);
                        return (
                          <Star
                            key={i}
                            className={`w-4 h-4 sm:w-5 sm:h-5 transition-colors ${
                              isFilled
                                ? "fill-amber-400 text-amber-400"
                                : "text-slate-200 dark:text-slate-700"
                            }`}
                          />
                        );
                      })}
                    </div>
                    <span className="text-xs text-slate-600 dark:text-slate-400 font-semibold">
                      {totalRatingsCount > 0
                        ? `${formatCount(totalRatingsCount)} ${totalRatingsCount === 1 ? "Rating" : "Ratings"}`
                        : "No Ratings Yet"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* If there are reviews, display them beneath the 2-column studio */}
            {reviews.length > 0 && (
              <div className="pt-2 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    Previous Verified Reviews ({reviews.length})
                  </h4>
                  {selectedStarFilter !== null && (
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                        Showing {selectedStarFilter}★ reviews ({displayedReviews.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedStarFilter(null)}
                        className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                {displayedReviews.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {displayedReviews.map((rev) => (
                      <div
                        key={rev.id}
                        className="bg-white dark:bg-slate-900/90 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-2 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center space-x-2">
                            <div className="flex items-center text-amber-400">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={`w-3.5 h-3.5 ${
                                    i < rev.rating
                                      ? "fill-amber-400 text-amber-400"
                                      : "text-slate-200 dark:text-slate-700"
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate max-w-[140px] sm:max-w-none">
                              {rev.user_name || "Verified Wholesale Buyer"}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                            {new Date(rev.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {rev.title && (
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">{rev.title}</h4>
                        )}
                        {rev.body && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                            {rev.body}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-center space-y-2 border border-slate-200/60 dark:border-slate-800">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      No reviews found with {selectedStarFilter} stars.
                    </p>
                    <button
                      type="button"
                      onClick={() => setSelectedStarFilter(null)}
                      className="text-xs font-bold text-orange-500 hover:underline cursor-pointer"
                    >
                      Show All Reviews
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : reviews.length > 0 ? (
          /* Default state when reviews exist: clean list */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {reviews.map((rev) => (
              <div
                key={rev.id}
                className="bg-white dark:bg-slate-900/90 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-2 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center text-amber-400">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3.5 h-3.5 ${
                            i < rev.rating
                              ? "fill-amber-400 text-amber-400"
                              : "text-slate-200 dark:text-slate-700"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate max-w-[140px] sm:max-w-none">
                      {rev.user_name || "Verified Wholesale Buyer"}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                    {new Date(rev.created_at).toLocaleDateString()}
                  </span>
                </div>
                {rev.title && (
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">{rev.title}</h4>
                )}
                {rev.body && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                    {rev.body}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* Default state when NO reviews exist: single clean, centered card with button */
          <div className="bg-slate-50/70 dark:bg-slate-900/60 p-6 sm:p-8 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-3 max-w-lg mx-auto transition-colors">
            <p className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200">
              No approved reviews yet for this product
            </p>
            <p className="text-[11px] sm:text-xs text-slate-400 dark:text-slate-500">
              Be the first verified wholesale buyer to leave a review!
            </p>
            <button
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                setShowReviewForm(true);
              }}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer"
            >
              <PenLine className="w-3.5 h-3.5" />
              <span>Write a Review</span>
            </button>
          </div>
        )}
      </section>

      {/* ── Similar Products Row (Compatibility Group / Same Cut Glass) ── */}
      {similarProducts.length > 0 && (
        <section className="pt-8 border-t border-slate-100 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Similar Products
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {product.specs?.compatibility_group
                  ? `Compatible with ${product.specs.compatibility_group}`
                  : product.specs?.brand_compatibility
                  ? `For ${product.specs.brand_compatibility} devices`
                  : "Matching category items in stock"}
              </p>
            </div>
            <Link
              to="/marketplace"
              className="text-xs font-bold text-brand-dark dark:text-orange-400 hover:underline"
            >
              View All →
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-5">
            {similarProducts.map((sim) => (
              <ProductCard
                key={sim.id}
                product={sim}
                onAddToCart={(p) => onAddToCart(p, p.min_order_qty || 1)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Related Category Accessories Section (Same Category & Family, Below Reviews) ── */}
      {displayedRelatedProducts.length > 0 && (
        <section className="pt-8 border-t border-slate-100 dark:border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center space-x-2">
                <span className="inline-block w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  Related Accessories
                </h2>
                {displayCategoryName && (
                  <span className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-200/50 dark:border-orange-900/40">
                    {displayCategoryName}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                High-margin wholesale accessories from the {displayCategoryName} collection
              </p>
            </div>
            <Link
              to={categoryMarketplaceUrl}
              className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:underline inline-flex items-center space-x-1 group self-start sm:self-auto"
            >
              <span>View All {displayCategoryName}</span>
              <span className="group-hover:translate-x-0.5 transition-transform">→</span>
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-5">
            {displayedRelatedProducts.map((rel) => (
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
