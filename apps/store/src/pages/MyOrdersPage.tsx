import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, Link } from "react-router";
import { fetchCustomerOrders } from "../services/storeService";
import { fetchOrderReturnsMap } from "../services/returnService";
import { useSettings } from "../context/SettingsContext";
import { triggerHaptic } from "../utils/haptics";
import { printOrderInvoice } from "../utils/invoiceGenerator";
import { ReturnRequestModal } from "../components/ReturnRequestModal";
import type { Order, Product, ReturnRequest } from "@urbanrat/shared";
import {
  Package,
  Search,
  CheckCircle2,
  RotateCcw,
  Copy,
  Check,
  ChevronRight,
  ShoppingBag,
  FileText,
  AlertCircle,
  Filter,
  X,
  RefreshCw,
  Loader2,
  ChevronLeft,
} from "lucide-react";

export interface MyOrdersPageProps {
  onAddToCart?: (product: Product, quantity?: number) => void;
}

type StatusFilter = "all" | "in_progress" | "delivered" | "cancelled" | "returned";
type TimeFilter = "all" | "30_days" | "6_months" | "this_year" | "older";

const PAGE_SIZE = 6;

export function MyOrdersPage({ onAddToCart }: MyOrdersPageProps) {
  const navigate = useNavigate();
  const { settings } = useSettings();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search query (order code, product name, SKU)
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");

  // Mobile Filter Drawer Toggle
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Copy Feedback
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  // Toast message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Issue & return request modal
  const [reportingOrder, setReportingOrder] = useState<Order | null>(null);

  // Return requests mapped by order_id
  const [orderReturnsMap, setOrderReturnsMap] = useState<Record<string, ReturnRequest>>({});

  // Quick lookup Order ID
  const [quickLookupId, setQuickLookupId] = useState("");
  const [quickLookupError, setQuickLookupError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, returnsMap] = await Promise.all([
        fetchCustomerOrders(),
        fetchOrderReturnsMap(),
      ]);
      setOrders(data);
      setOrderReturnsMap(returnsMap);
    } catch (err: unknown) {
      console.error("Failed to load customer orders:", err);
      const e = err as Error;
      setError(e.message || "Failed to load orders. Please retry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }

  function handleCopyOrderId(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    triggerHaptic("selection");
    navigator.clipboard.writeText(id);
    setCopiedOrderId(id);
    showToast(`Order ID #${id} copied`);
    setTimeout(() => setCopiedOrderId(null), 2500);
  }

  function handleQuickLookup(e: React.FormEvent) {
    e.preventDefault();
    triggerHaptic("selection");
    const clean = quickLookupId.trim().toUpperCase();
    if (!clean) {
      setQuickLookupError("Please enter an Order ID");
      triggerHaptic("heavy");
      return;
    }
    setQuickLookupError(null);
    navigate(`/order/${clean}`);
  }

  function handleReorder(order: Order, e: React.MouseEvent) {
    e.stopPropagation();
    triggerHaptic("success");

    let count = 0;
    order.items.forEach((item) => {
      count += item.quantity;
      if (onAddToCart) {
        const dummyProduct: Product = {
          id: item.product_id,
          name: item.name,
          slug: item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          description: "",
          price: item.price || item.unit_price || 0,
          mrp: item.mrp || item.price || item.unit_price || 0,
          stock: 9999,
          images: item.image ? [item.image] : [],
          category_id: null,
          is_urbanrat_brand: true,
          is_active: true,
          is_featured: false,
          sku: item.sku || null,
          created_at: new Date().toISOString(),
        };
        onAddToCart(dummyProduct, item.quantity);
      }
    });

    showToast(`Added ${count} items from Order #${order.id} to cart!`);
  }

  // Filtered and Searched Orders
  const filteredOrders = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();

    return orders.filter((order) => {
      // 1. Search Query (order code, product name, sku)
      if (appliedSearch.trim()) {
        const q = appliedSearch.trim().toLowerCase();
        const matchesId = order.id.toLowerCase().includes(q);
        const matchesProduct = order.items.some(
          (it) =>
            it.name.toLowerCase().includes(q) ||
            (it.sku && it.sku.toLowerCase().includes(q))
        );
        if (!matchesId && !matchesProduct) return false;
      }

      // 2. Status Filter
      if (statusFilter !== "all") {
        const st = (order.status || "").toLowerCase();
        if (statusFilter === "in_progress") {
          if (!["pending", "confirmed", "processing", "shipped"].includes(st)) return false;
        } else if (statusFilter === "delivered") {
          if (st !== "delivered") return false;
        } else if (statusFilter === "cancelled") {
          if (!["cancelled", "refunded"].includes(st)) return false;
        } else if (statusFilter === "returned") {
          if (st !== "returned") return false;
        }
      }

      // 3. Time Filter
      if (timeFilter !== "all") {
        const orderDate = new Date(order.created_at);
        const diffDays = (now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24);

        if (timeFilter === "30_days") {
          if (diffDays > 30) return false;
        } else if (timeFilter === "6_months") {
          if (diffDays > 180) return false;
        } else if (timeFilter === "this_year") {
          if (orderDate.getFullYear() !== currentYear) return false;
        } else if (timeFilter === "older") {
          if (orderDate.getFullYear() >= currentYear) return false;
        }
      }

      return true;
    });
  }, [orders, appliedSearch, statusFilter, timeFilter]);

  // Reset pagination on filter/search change
  useEffect(() => {
    setCurrentPage(1);
  }, [appliedSearch, statusFilter, timeFilter]);

  const totalPages = Math.ceil(filteredOrders.length / PAGE_SIZE) || 1;
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredOrders.slice(start, start + PAGE_SIZE);
  }, [filteredOrders, currentPage]);

  const hasActiveFilters =
    statusFilter !== "all" || timeFilter !== "all" || appliedSearch.trim() !== "";

  function clearAllFilters() {
    triggerHaptic("selection");
    setStatusFilter("all");
    setTimeFilter("all");
    setSearchQuery("");
    setAppliedSearch("");
  }

  // Derive status details
  function getStatusMeta(order: Order) {
    const st = (order.status || "pending").toLowerCase();
    const latestEvent = order.events && order.events.length > 0
      ? order.events[order.events.length - 1]
      : null;

    if (st === "delivered") {
      return {
        dotClass: "bg-emerald-500",
        badgeBg: "bg-emerald-50 text-emerald-800 border-emerald-200",
        title: `Delivered on ${new Date(latestEvent?.created_at || order.updated_at || order.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}`,
        message: latestEvent?.note || "Your wholesale consignment has been safely delivered.",
        canReturn: true,
      };
    }
    if (st === "cancelled" || st === "refunded") {
      return {
        dotClass: "bg-rose-500",
        badgeBg: "bg-rose-50 text-rose-800 border-rose-200",
        title: `Cancelled on ${new Date(order.updated_at || order.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}`,
        message: order.cancel_reason || latestEvent?.note || "Order was cancelled as requested.",
        canReturn: false,
      };
    }
    if (st === "returned") {
      return {
        dotClass: "bg-amber-500",
        badgeBg: "bg-amber-50 text-amber-800 border-amber-200",
        title: `Replacement / Return Processed`,
        message: latestEvent?.note || "Return claim processed under 1-Year Wholesale Warranty.",
        canReturn: false,
      };
    }
    if (st === "shipped") {
      return {
        dotClass: "bg-sky-500",
        badgeBg: "bg-sky-50 text-sky-800 border-sky-200",
        title: `Dispatched & In Transit`,
        message: latestEvent?.note || "Consignment handed over to express freight cargo.",
        canReturn: true,
      };
    }
    if (st === "processing") {
      return {
        dotClass: "bg-purple-500",
        badgeBg: "bg-purple-50 text-purple-800 border-purple-200",
        title: `Processing in Warehouse`,
        message: latestEvent?.note || "QC inspection and carton packing underway.",
        canReturn: false,
      };
    }
    if (st === "confirmed") {
      return {
        dotClass: "bg-blue-500",
        badgeBg: "bg-blue-50 text-blue-800 border-blue-200",
        title: `Order Confirmed`,
        message: latestEvent?.note || "Stock reserved and invoice verified.",
        canReturn: false,
      };
    }

    return {
      dotClass: "bg-slate-400",
      badgeBg: "bg-slate-50 text-slate-700 border-slate-200",
      title: `Order Received`,
      message: latestEvent?.note || "Order placed and awaiting warehouse confirmation.",
      canReturn: false,
    };
  }

  function getReturnWindowInfo(order: Order, returnWindowDays = 7) {
    if (order.status.toLowerCase() !== "delivered") {
      return { isDelivered: false, isWithinWindow: false, daysRemaining: 0 };
    }
    const deliveredEv = (order.events || order.order_events || []).find(
      (e) => e.status.toLowerCase() === "delivered"
    );
    const deliveryDate = deliveredEv
      ? new Date(deliveredEv.created_at)
      : new Date(order.updated_at || order.created_at);
    const diffDays = Math.floor(
      (Date.now() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const isWithin = diffDays <= returnWindowDays;
    return {
      isDelivered: true,
      isWithinWindow: isWithin,
      daysRemaining: Math.max(0, returnWindowDays - diffDays),
    };
  }

  return (
    <div className="w-full max-w-7xl mx-auto py-3 sm:py-6 px-2 sm:px-4 space-y-4 sm:space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-xs font-semibold text-white shadow-lg animate-in fade-in bg-slate-900 flex items-center space-x-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Breadcrumbs ── */}
      <nav aria-label="Breadcrumb" className="flex items-center space-x-1.5 text-[11px] text-slate-400 font-medium">
        <Link to="/" className="hover:text-slate-800 transition">
          Home
        </Link>
        <span>&gt;</span>
        <Link to="/account" className="hover:text-slate-800 transition">
          My Account
        </Link>
        <span>&gt;</span>
        <span className="text-slate-800 font-bold">My Orders</span>
      </nav>

      {/* ── Desktop Two-Column Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ── Left Sidebar: Marketplace Filter Panel ── */}
        <aside className="hidden lg:block lg:col-span-3 bg-white rounded-3xl p-5 border border-slate-100 shadow-2xs space-y-6 sticky top-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="font-black text-sm uppercase tracking-wider text-slate-900 flex items-center space-x-2">
              <Filter className="w-4 h-4 text-brand-dark" />
              <span>Filters</span>
            </h2>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-[11px] font-bold text-brand-dark hover:underline cursor-pointer"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2.5">
              Order Status
            </h3>
            <div className="space-y-2">
              {[
                { id: "all", label: "All Orders" },
                { id: "in_progress", label: "On the way / In Progress" },
                { id: "delivered", label: "Delivered" },
                { id: "cancelled", label: "Cancelled" },
                { id: "returned", label: "Returned / Replaced" },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className="flex items-center space-x-2.5 text-xs text-slate-700 font-medium cursor-pointer select-none hover:text-slate-900"
                >
                  <input
                    type="radio"
                    name="order_status"
                    checked={statusFilter === opt.id}
                    onChange={() => {
                      triggerHaptic("selection");
                      setStatusFilter(opt.id as StatusFilter);
                    }}
                    className="w-4 h-4 text-brand-dark focus:ring-brand-light border-slate-300"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Time Filter */}
          <div className="pt-3 border-t border-slate-100">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2.5">
              Order Time
            </h3>
            <div className="space-y-2">
              {[
                { id: "all", label: "Anytime" },
                { id: "30_days", label: "Last 30 days" },
                { id: "6_months", label: "Past 6 months" },
                { id: "this_year", label: `This Year (${new Date().getFullYear()})` },
                { id: "older", label: "Older Orders" },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className="flex items-center space-x-2.5 text-xs text-slate-700 font-medium cursor-pointer select-none hover:text-slate-900"
                >
                  <input
                    type="radio"
                    name="order_time"
                    checked={timeFilter === opt.id}
                    onChange={() => {
                      triggerHaptic("selection");
                      setTimeFilter(opt.id as TimeFilter);
                    }}
                    className="w-4 h-4 text-brand-dark focus:ring-brand-light border-slate-300"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Quick Track Link for Guests */}
          <div className="pt-4 border-t border-slate-100">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 text-xs space-y-2">
              <p className="font-bold text-slate-800 text-[11px]">Looking for a guest order?</p>
              <form onSubmit={handleQuickLookup} className="space-y-2">
                <input
                  type="text"
                  value={quickLookupId}
                  onChange={(e) => setQuickLookupId(e.target.value)}
                  placeholder="e.g. URT-261019-ABCD"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-brand-dark font-mono uppercase"
                />
                <button
                  type="submit"
                  className="w-full py-1.5 px-3 rounded-xl bg-slate-900 text-white font-bold text-[11px] hover:bg-slate-800 transition cursor-pointer"
                >
                  Track Order
                </button>
              </form>
            </div>
          </div>
        </aside>

        {/* ── Main Orders Area ── */}
        <div className="lg:col-span-9 space-y-4">
          {/* ── Search Bar & Mobile Filter Trigger ── */}
          <div className="bg-white rounded-3xl p-3 sm:p-4 border border-slate-100 shadow-2xs space-y-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                triggerHaptic("selection");
                setAppliedSearch(searchQuery);
              }}
              className="flex items-center space-x-2"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search your orders here (Order Code, Product Name, SKU)..."
                  className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:bg-white focus:border-brand-dark transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setAppliedSearch("");
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="submit"
                className="hidden sm:inline-flex items-center space-x-1.5 px-5 py-2.5 rounded-2xl text-white font-bold text-xs shadow-sm hover:opacity-95 transition cursor-pointer bg-linear-to-b from-brand-light to-brand-dark shrink-0"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Search Orders</span>
              </button>

              {/* Mobile Filter Sheet Button */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("selection");
                  setMobileFiltersOpen(true);
                }}
                className="lg:hidden p-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition cursor-pointer shrink-0 relative"
              >
                <Filter className="w-4 h-4" />
                {hasActiveFilters && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-brand-dark" />
                )}
              </button>
            </form>

            {/* Active filter chips */}
            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                <span className="text-[11px] font-bold text-slate-400 mr-1">Active filters:</span>
                {appliedSearch && (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium text-[11px]">
                    <span>Search: "{appliedSearch}"</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("");
                        setAppliedSearch("");
                      }}
                      className="cursor-pointer hover:text-slate-900"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {statusFilter !== "all" && (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-sky-50 text-brand-dark font-bold text-[11px] border border-sky-100">
                    <span className="capitalize">{statusFilter.replace("_", " ")}</span>
                    <button
                      type="button"
                      onClick={() => setStatusFilter("all")}
                      className="cursor-pointer hover:text-slate-900"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {timeFilter !== "all" && (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium text-[11px]">
                    <span className="capitalize">{timeFilter.replace("_", " ")}</span>
                    <button
                      type="button"
                      onClick={() => setTimeFilter("all")}
                      className="cursor-pointer hover:text-slate-900"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="text-[11px] text-rose-600 font-bold hover:underline ml-1 cursor-pointer"
                >
                  Reset all
                </button>
              </div>
            )}
          </div>

          {/* ── Loading State ── */}
          {loading && (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-2xs space-y-3">
              <Loader2 className="w-8 h-8 text-brand-dark animate-spin mx-auto" />
              <p className="text-xs text-slate-500 font-medium">Fetching wholesale order history...</p>
            </div>
          )}

          {/* ── Error State ── */}
          {!loading && error && (
            <div className="bg-white rounded-3xl p-8 text-center border border-rose-100 shadow-2xs space-y-3">
              <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-sm text-slate-900">Failed to load orders</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">{error}</p>
              <button
                type="button"
                onClick={loadOrders}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition cursor-pointer"
              >
                Try Again
              </button>
            </div>
          )}

          {/* ── Empty State ── */}
          {!loading && !error && filteredOrders.length === 0 && (
            <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-slate-100 shadow-2xs space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto">
                <Package className="w-8 h-8 stroke-[1.8]" />
              </div>
              <div className="max-w-sm mx-auto">
                <h3 className="font-black text-base text-slate-900">
                  {hasActiveFilters ? "No matching orders found" : "No orders placed yet"}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {hasActiveFilters
                    ? "Try adjusting your search query, status, or date range filter to locate past consignments."
                    : "Your past wholesale purchases, bulk invoices, and live carrier dispatches will appear here."}
                </p>
              </div>

              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition cursor-pointer"
                >
                  Clear All Filters
                </button>
              ) : (
                <Link
                  to="/marketplace"
                  onClick={() => triggerHaptic("selection")}
                  className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-white font-black text-xs shadow-sm hover:opacity-95 transition active:scale-95 cursor-pointer bg-linear-to-b from-brand-light to-brand-dark"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Explore Wholesale Marketplace</span>
                </Link>
              )}

              {/* Direct Quick Order Tracking */}
              <div className="pt-4 border-t border-slate-100 max-w-sm mx-auto text-left space-y-2">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Track via Order Code:
                </p>
                <form onSubmit={handleQuickLookup} className="flex gap-2">
                  <input
                    type="text"
                    value={quickLookupId}
                    onChange={(e) => {
                      setQuickLookupId(e.target.value);
                      setQuickLookupError(null);
                    }}
                    placeholder="e.g. 748291"
                    className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-dark"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition cursor-pointer"
                  >
                    Track
                  </button>
                </form>
                {quickLookupError && (
                  <p className="text-xs text-rose-600 font-semibold">{quickLookupError}</p>
                )}
              </div>
            </div>
          )}

          {/* ── Marketplace Order Cards List ── */}
          {!loading && !error && paginatedOrders.length > 0 && (
            <div className="space-y-4">
              {paginatedOrders.map((order) => {
                const meta = getStatusMeta(order);
                const firstItem = order.items[0];
                const moreCount = order.items.length - 1;
                const existingReturn = orderReturnsMap[order.id];
                const returnInfo = getReturnWindowInfo(order, settings?.return_window_days ?? 7);

                return (
                  <div
                    key={order.id}
                    onClick={() => {
                      triggerHaptic("selection");
                      navigate(`/order/${order.id}`);
                    }}
                    className="bg-white rounded-3xl border border-slate-100 hover:border-slate-200 transition-all p-4 sm:p-5 shadow-2xs hover:shadow-xs cursor-pointer group"
                  >
                    {/* Top Row: Order Code & Date */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-black text-slate-900">
                          #{order.id}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleCopyOrderId(order.id, e)}
                          title="Copy Order Code"
                          className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                        >
                          {copiedOrderId === order.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <span className="text-[11px] text-slate-400">&bull;</span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          Placed on {new Date(order.created_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>

                        {/* Return Badge (Requirement 5) */}
                        {existingReturn && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerHaptic("selection");
                              navigate(`/returns/${existingReturn.id}`);
                            }}
                            className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border cursor-pointer hover:opacity-90 transition ${
                              existingReturn.status === "refunded"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : existingReturn.status === "rejected"
                                ? "bg-rose-50 text-rose-800 border-rose-200"
                                : existingReturn.type === "replacement" && existingReturn.status === "closed"
                                ? "bg-teal-50 text-teal-800 border-teal-200"
                                : "bg-amber-50 text-amber-800 border-amber-200"
                            }`}
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>
                              {existingReturn.status === "refunded"
                                ? "Refunded"
                                : existingReturn.type === "replacement" && existingReturn.status === "closed"
                                ? "Replacement Completed"
                                : existingReturn.status === "rejected"
                                ? "Return Rejected"
                                : existingReturn.type === "replacement"
                                ? "Replacement Requested"
                                : "Return Requested"}
                            </span>
                          </span>
                        )}
                      </div>

                      {/* Total Amount */}
                      <div className="text-left sm:text-right">
                        <span className="text-[11px] text-slate-400 mr-1.5">Total Paid:</span>
                        <span className="font-black text-sm sm:text-base text-slate-900">
                          ₹{order.total.toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>

                    {/* Middle Row: Product Card Layout inspired by Marketplace */}
                    <div className="py-3.5 grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                      {/* Thumbnail & Items List (Left 8 cols) */}
                      <div className="md:col-span-7 flex space-x-3.5">
                        {/* Thumbnail with (+N more) badge */}
                        <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-50 border border-slate-100 overflow-hidden shrink-0">
                          {firstItem?.image ? (
                            <img
                              src={firstItem.image}
                              alt={firstItem.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                              <Package className="w-7 h-7" />
                            </div>
                          )}
                          {moreCount > 0 && (
                            <div className="absolute inset-x-0 bottom-0 bg-slate-900/75 backdrop-blur-2xs text-white text-[9px] font-black text-center py-0.5">
                              +{moreCount} more
                            </div>
                          )}
                        </div>

                        {/* Title & Wholesale Price / Volume Tier Details */}
                        <div className="min-w-0 flex-1 space-y-1">
                          <h3 className="font-bold text-xs sm:text-sm text-slate-900 line-clamp-1 group-hover:text-brand-dark transition-colors">
                            {firstItem?.name || "Wholesale Merchandise"}
                          </h3>

                          {firstItem?.sku && (
                            <p className="text-[11px] text-slate-400 font-mono">
                              SKU: {firstItem.sku}
                            </p>
                          )}

                          {/* Line items quantity & tier breakdown */}
                          <div className="pt-0.5 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                              <span className="font-bold text-slate-800">
                                Qty: {firstItem?.quantity} pcs
                              </span>
                              <span>&bull;</span>
                              <span>₹{firstItem?.unit_price || firstItem?.price || 0} / pc</span>
                              {firstItem?.tier_min_qty && (
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded-md text-[10px] font-bold bg-sky-50 text-brand-dark border border-sky-100">
                                  Tier ({firstItem.tier_min_qty}+)
                                </span>
                              )}
                            </div>

                            {moreCount > 0 && (
                              <p className="text-[11px] text-slate-400 font-medium">
                                and {moreCount} other wholesale {moreCount === 1 ? "product" : "products"}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status & Latest Status Message (Right 5 cols) */}
                      <div className="md:col-span-5 md:border-l md:border-slate-100 md:pl-4 space-y-1.5">
                        <div className="flex items-center space-x-2">
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${meta.dotClass}`} />
                          <span className="font-bold text-xs text-slate-900">
                            {meta.title}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">
                          {meta.message}
                        </p>
                      </div>
                    </div>

                    {/* Bottom Action Buttons Row */}
                    <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        {existingReturn ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerHaptic("selection");
                              navigate(`/returns/${existingReturn.id}`);
                            }}
                            className="text-xs font-bold text-brand-dark hover:underline flex items-center space-x-1 cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>View Return ({existingReturn.return_code})</span>
                          </button>
                        ) : returnInfo.isDelivered ? (
                          returnInfo.isWithinWindow ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                triggerHaptic("selection");
                                setReportingOrder(order);
                              }}
                              className="text-xs font-bold text-slate-700 hover:text-brand-dark transition cursor-pointer flex items-center space-x-1.5"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                              <span>Return / Replace</span>
                              <span className="text-[10px] text-slate-400 font-normal">
                                ({returnInfo.daysRemaining}d left)
                              </span>
                            </button>
                          ) : (
                            <span className="text-xs font-medium text-slate-400 flex items-center space-x-1 select-none">
                              <RotateCcw className="w-3.5 h-3.5 text-slate-300" />
                              <span>Return window closed</span>
                            </span>
                          )
                        ) : null}
                      </div>

                      <div className="flex items-center space-x-2">
                        {/* Download Invoice */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            triggerHaptic("selection");
                            printOrderInvoice(order, settings);
                          }}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer flex items-center space-x-1"
                        >
                          <FileText className="w-3.5 h-3.5 text-slate-400" />
                          <span>Invoice</span>
                        </button>

                        {/* Reorder */}
                        <button
                          type="button"
                          onClick={(e) => handleReorder(order, e)}
                          className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition active:scale-95 cursor-pointer flex items-center space-x-1.5 shadow-2xs"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Reorder</span>
                        </button>

                        {/* View Details */}
                        <span className="inline-flex items-center text-xs font-bold text-brand-dark group-hover:translate-x-0.5 transition-transform ml-1">
                          <span>Details</span>
                          <ChevronRight className="w-4 h-4" />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* ── Pagination ── */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 pb-8">
                  <p className="text-xs text-slate-400 font-medium">
                    Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                    {Math.min(currentPage * PAGE_SIZE, filteredOrders.length)} of{" "}
                    {filteredOrders.length} orders
                  </p>

                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => {
                        triggerHaptic("selection");
                        setCurrentPage((p) => Math.max(1, p - 1));
                      }}
                      className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4 text-slate-600" />
                    </button>

                    {Array.from({ length: totalPages }).map((_, i) => {
                      const pageNum = i + 1;
                      const isActive = pageNum === currentPage;
                      return (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => {
                            triggerHaptic("selection");
                            setCurrentPage(pageNum);
                          }}
                          className={`w-8 h-8 rounded-xl text-xs font-bold transition cursor-pointer ${
                            isActive
                              ? "bg-brand-dark text-white shadow-xs"
                              : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      disabled={currentPage >= totalPages}
                      onClick={() => {
                        triggerHaptic("selection");
                        setCurrentPage((p) => Math.min(totalPages, p + 1));
                      }}
                      className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile Filters Bottom Sheet ── */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 bg-black/50 backdrop-blur-xs animate-in fade-in lg:hidden">
          <div className="relative w-full bg-white rounded-t-4xl p-5 shadow-2xl border border-slate-100 max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
            <div className="pt-1 pb-3 flex justify-center">
              <div className="w-10 h-1 bg-slate-200 rounded-full" />
            </div>

            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-black text-base text-slate-900">Order Filters</h3>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-5 pb-4">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                  Status
                </h4>
                <div className="space-y-2">
                  {[
                    { id: "all", label: "All Orders" },
                    { id: "in_progress", label: "On the way / In Progress" },
                    { id: "delivered", label: "Delivered" },
                    { id: "cancelled", label: "Cancelled" },
                    { id: "returned", label: "Returned / Replaced" },
                  ].map((opt) => (
                    <label key={opt.id} className="flex items-center space-x-2 text-xs font-medium text-slate-800">
                      <input
                        type="radio"
                        name="mob_order_status"
                        checked={statusFilter === opt.id}
                        onChange={() => setStatusFilter(opt.id as StatusFilter)}
                        className="w-4 h-4 text-brand-dark"
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                  Time Period
                </h4>
                <div className="space-y-2">
                  {[
                    { id: "all", label: "Anytime" },
                    { id: "30_days", label: "Last 30 days" },
                    { id: "6_months", label: "Past 6 months" },
                    { id: "this_year", label: `This Year (${new Date().getFullYear()})` },
                    { id: "older", label: "Older Orders" },
                  ].map((opt) => (
                    <label key={opt.id} className="flex items-center space-x-2 text-xs font-medium text-slate-800">
                      <input
                        type="radio"
                        name="mob_order_time"
                        checked={timeFilter === opt.id}
                        onChange={() => setTimeFilter(opt.id as TimeFilter)}
                        className="w-4 h-4 text-brand-dark"
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex space-x-2">
              <button
                type="button"
                onClick={clearAllFilters}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-brand-dark text-white text-xs font-bold"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Return / Replacement Flow Modal ── */}
      <ReturnRequestModal
        isOpen={Boolean(reportingOrder)}
        onClose={() => setReportingOrder(null)}
        order={reportingOrder}
        onSuccess={() => {
          loadOrders();
        }}
      />
    </div>
  );
}
