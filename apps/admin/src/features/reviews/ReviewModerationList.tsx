import { useState, useEffect } from "react";
import {
  Star,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  ExternalLink,
  RotateCcw,
  Trash2,
  ShieldCheck,
  Check,
  X,
  MessageSquare,
} from "lucide-react";
import {
  fetchAdminReviews,
  fetchAdminReviewCounts,
  adminUpdateReviewStatus,
  adminDeleteReview,
  type AdminReviewItem,
} from "../../lib/adminService";
import { triggerHaptic } from "../../utils/haptics";

export function ReviewModerationList() {
  const [reviews, setReviews] = useState<AdminReviewItem[]>([]);
  const [counts, setCounts] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0,
  });
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [starFilter, setStarFilter] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Load reviews and counts
  async function loadData() {
    setLoading(true);
    try {
      const [revs, countData] = await Promise.all([
        fetchAdminReviews({ status: activeTab, search: searchQuery, rating: starFilter || undefined }),
        fetchAdminReviewCounts(),
      ]);
      setReviews(revs);
      setCounts(countData);
    } catch (err) {
      console.error("Failed to load reviews:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [activeTab, starFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Flash action notification
  function notify(msg: string) {
    setActionSuccessMessage(msg);
    setTimeout(() => {
      setActionSuccessMessage(null);
    }, 3500);
  }

  async function handleApprove(review: AdminReviewItem) {
    triggerHaptic("success");
    try {
      await adminUpdateReviewStatus(review.id, "approved");
      notify(`Approved review for "${review.product_name}". It is now published live on the storefront.`);
      await loadData();
    } catch (err) {
      console.error("Failed to approve review:", err);
    }
  }

  async function handleReject(review: AdminReviewItem) {
    triggerHaptic("medium");
    try {
      await adminUpdateReviewStatus(review.id, "rejected");
      notify(`Rejected review for "${review.product_name}". It has been hidden from the storefront.`);
      await loadData();
    } catch (err) {
      console.error("Failed to reject review:", err);
    }
  }

  async function handleDelete(review: AdminReviewItem) {
    if (!window.confirm(`Are you sure you want to delete this review by "${review.user_name}"?`)) {
      return;
    }
    triggerHaptic("medium");
    try {
      await adminDeleteReview(review.id);
      notify("Review permanently deleted.");
      await loadData();
    } catch (err) {
      console.error("Failed to delete review:", err);
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Action Notification Banner ── */}
      {actionSuccessMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center justify-between text-xs font-bold animate-in fade-in slide-in-from-top-2 duration-200 shadow-xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccessMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccessMessage(null)}
            className="text-emerald-500 hover:text-emerald-800 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Page Header & Context Banner ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center text-sm shadow-xs">
              <Star className="w-4 h-4 fill-white" />
            </div>
            <span>Review Approvals &amp; Moderation</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Ratings <strong className="text-amber-600">below 4 stars</strong> require admin approval before appearing on the product. Ratings <strong className="text-emerald-600">4 stars and above</strong> are automatically published.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            triggerHaptic("selection");
            loadData();
          }}
          className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs transition active:scale-95 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
          <span>Refresh</span>
        </button>
      </div>

      {/* ── Summary Statistics Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Pending Approval */}
        <div
          onClick={() => setActiveTab("pending")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === "pending"
              ? "bg-amber-500/10 border-amber-300 shadow-sm ring-1 ring-amber-400/40"
              : "bg-white border-slate-200/80 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
              Pending Approval
            </span>
            <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">
              {counts.pending}
            </span>
            <span className="text-[11px] font-semibold text-amber-600">Below 4 Stars</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Awaiting your approval</p>
        </div>

        {/* Approved & Live */}
        <div
          onClick={() => setActiveTab("approved")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === "approved"
              ? "bg-emerald-500/10 border-emerald-300 shadow-sm ring-1 ring-emerald-400/40"
              : "bg-white border-slate-200/80 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
              Approved &amp; Live
            </span>
            <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">
              {counts.approved}
            </span>
            <span className="text-[11px] font-semibold text-emerald-600">Live on Store</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">4-5★ auto &amp; admin approved</p>
        </div>

        {/* Rejected */}
        <div
          onClick={() => setActiveTab("rejected")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === "rejected"
              ? "bg-rose-500/10 border-rose-300 shadow-sm ring-1 ring-rose-400/40"
              : "bg-white border-slate-200/80 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">
              Rejected
            </span>
            <div className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
              <XCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">
              {counts.rejected}
            </span>
            <span className="text-[11px] font-semibold text-rose-600">Hidden</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Disapproved by admin</p>
        </div>

        {/* Total Reviews */}
        <div
          onClick={() => setActiveTab("all")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === "all"
              ? "bg-slate-900 text-white border-slate-900 shadow-sm"
              : "bg-white border-slate-200/80 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-[11px] font-bold uppercase tracking-wider ${
                activeTab === "all" ? "text-slate-300" : "text-slate-500"
              }`}
            >
              Total Customer Feedback
            </span>
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center ${
                activeTab === "all" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span
              className={`text-2xl sm:text-3xl font-black ${
                activeTab === "all" ? "text-white" : "text-slate-900"
              }`}
            >
              {counts.total}
            </span>
            <span className="text-[11px] text-slate-400">All ratings</span>
          </div>
          <p
            className={`text-[11px] mt-1 ${
              activeTab === "all" ? "text-slate-300" : "text-slate-400"
            }`}
          >
            Across all products
          </p>
        </div>
      </div>

      {/* ── Status Tab Navigation ── */}
      <div className="flex items-center space-x-2 border-b border-slate-200 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => {
            triggerHaptic("selection");
            setActiveTab("pending");
          }}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold tracking-tight transition-all flex items-center space-x-2 border-b-2 cursor-pointer shrink-0 ${
            activeTab === "pending"
              ? "border-amber-500 text-amber-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Pending Approval</span>
          <span
            className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
              activeTab === "pending"
                ? "bg-amber-100 text-amber-800"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {counts.pending}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic("selection");
            setActiveTab("approved");
          }}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold tracking-tight transition-all flex items-center space-x-2 border-b-2 cursor-pointer shrink-0 ${
            activeTab === "approved"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Approved &amp; Live</span>
          <span
            className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
              activeTab === "approved"
                ? "bg-emerald-100 text-emerald-800"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {counts.approved}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic("selection");
            setActiveTab("rejected");
          }}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold tracking-tight transition-all flex items-center space-x-2 border-b-2 cursor-pointer shrink-0 ${
            activeTab === "rejected"
              ? "border-rose-600 text-rose-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <XCircle className="w-4 h-4" />
          <span>Rejected</span>
          <span
            className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
              activeTab === "rejected"
                ? "bg-rose-100 text-rose-800"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {counts.rejected}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic("selection");
            setActiveTab("all");
          }}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold tracking-tight transition-all flex items-center space-x-2 border-b-2 cursor-pointer shrink-0 ${
            activeTab === "all"
              ? "border-slate-900 text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>All Reviews</span>
          <span
            className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
              activeTab === "all"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {counts.total}
          </span>
        </button>
      </div>

      {/* ── Search & Star Filters Console ── */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by product, customer name, review headline or body..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Star Rating Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pr-1">
            Rating:
          </span>
          <button
            type="button"
            onClick={() => setStarFilter(null)}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer shrink-0 ${
              starFilter === null
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All
          </button>
          {[5, 4, 3, 2, 1].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStarFilter(starFilter === s ? null : s)}
              className={`inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer shrink-0 ${
                starFilter === s
                  ? s < 4
                    ? "bg-amber-500 text-white"
                    : "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <span>{s}</span>
              <Star
                className={`w-3 h-3 ${
                  starFilter === s ? "fill-white text-white" : "fill-amber-400 text-amber-400"
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      {/* ── Review Cards Feed ── */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80">
          <RotateCcw className="w-6 h-6 text-amber-500 animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500 font-bold">Loading review moderation queue...</p>
        </div>
      ) : reviews.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto text-slate-400">
            {activeTab === "pending" ? (
              <ShieldCheck className="w-6 h-6 text-emerald-500" />
            ) : (
              <MessageSquare className="w-6 h-6 text-slate-400" />
            )}
          </div>
          <h3 className="text-sm font-bold text-slate-800">
            {activeTab === "pending"
              ? "All Clear! No Reviews Pending Approval"
              : "No reviews found matching current filter"}
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {activeTab === "pending"
              ? "When customers submit reviews below 4 stars, they will appear here for your review and sign-off before being shown on the storefront."
              : "Try switching tabs or resetting the star filter and search query."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((rev) => {
            const isPending = rev.status === "pending";
            const isApproved = rev.status === "approved";
            const isRejected = rev.status === "rejected";
            const isLowRating = rev.rating < 4;

            return (
              <div
                key={rev.id}
                className={`bg-white rounded-2xl p-4 sm:p-5 border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs ${
                  isPending
                    ? "border-amber-200 hover:border-amber-300"
                    : isApproved
                    ? "border-slate-200/80 hover:border-emerald-200"
                    : "border-slate-200/80 opacity-75 hover:opacity-100"
                }`}
              >
                {/* Product Thumbnail & Details */}
                <div className="flex items-start space-x-3.5 flex-1 min-w-0">
                  <div className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200/80 overflow-hidden shrink-0">
                    <img
                      src={
                        rev.product_image ||
                        "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=200"
                      }
                      alt={rev.product_name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    {/* Header Row: Product Name + Status Badge */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-black text-slate-900 truncate max-w-xs sm:max-w-md">
                        {rev.product_name}
                      </span>

                      {/* Status Pill */}
                      {isPending && (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="w-3 h-3 text-amber-500" />
                          <span>Requires Approval (Below 4★)</span>
                        </span>
                      )}
                      {isApproved && (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>Live on Product</span>
                        </span>
                      )}
                      {isRejected && (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
                          <XCircle className="w-3 h-3 text-rose-500" />
                          <span>Rejected</span>
                        </span>
                      )}
                    </div>

                    {/* Star Rating Display */}
                    <div className="flex items-center space-x-1.5">
                      <div className="flex items-center space-x-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-3.5 h-3.5 ${
                              star <= rev.rating
                                ? "fill-amber-400 text-amber-400"
                                : "fill-slate-200 text-slate-200"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs font-black text-slate-800">
                        {rev.rating}.0
                      </span>
                      {isLowRating && isPending && (
                        <span className="text-[10px] text-amber-600 font-semibold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200/50">
                          Low rating alert
                        </span>
                      )}
                    </div>

                    {/* Review Title & Body */}
                    {rev.title && (
                      <p className="text-xs font-bold text-slate-800">
                        {rev.title}
                      </p>
                    )}
                    {rev.body && (
                      <p className="text-xs text-slate-600 line-clamp-2">
                        {rev.body}
                      </p>
                    )}

                    {/* Reviewer Name & Timestamp */}
                    <div className="flex items-center space-x-3 text-[11px] text-slate-400 pt-0.5">
                      <span className="font-semibold text-slate-600">
                        👤 {rev.user_name || "Verified Wholesale Buyer"}
                      </span>
                      <span>•</span>
                      <span>
                        {new Date(rev.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {rev.product_slug && (
                        <>
                          <span>•</span>
                          <a
                            href={`/product/${rev.product_slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center space-x-1 text-brand-dark hover:underline"
                          >
                            <span>View Product</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Action Buttons ── */}
                <div className="flex items-center space-x-2 shrink-0 self-end md:self-center pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 w-full md:w-auto justify-end">
                  {/* If Pending: show Approve & Reject buttons */}
                  {isPending && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleApprove(rev)}
                        className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer"
                        title="Approve and publish to storefront"
                      >
                        <Check className="w-3.5 h-3.5 stroke-3" />
                        <span>Approve Review</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleReject(rev)}
                        className="inline-flex items-center space-x-1 px-3 py-2 border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 rounded-xl text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer"
                        title="Reject review"
                      >
                        <X className="w-3.5 h-3.5 stroke-3" />
                        <span>Reject</span>
                      </button>
                    </>
                  )}

                  {/* If Approved: show Unpublish/Reject option */}
                  {isApproved && (
                    <button
                      type="button"
                      onClick={() => handleReject(rev)}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 border border-slate-200 bg-white hover:bg-rose-50 hover:text-rose-600 text-slate-600 rounded-xl text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer"
                      title="Unpublish this review from storefront"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Unpublish</span>
                    </button>
                  )}

                  {/* If Rejected: show Re-approve option */}
                  {isRejected && (
                    <button
                      type="button"
                      onClick={() => handleApprove(rev)}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer"
                      title="Approve and publish"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Re-Approve</span>
                    </button>
                  )}

                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={() => handleDelete(rev)}
                    className="w-8 h-8 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition active:scale-95 cursor-pointer"
                    title="Delete permanently"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
