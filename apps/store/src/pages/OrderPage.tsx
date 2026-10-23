import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { fetchOrderById } from "../services/storeService";
import { useSettings } from "../context/SettingsContext";
import { useAuth } from "../context/AuthContext";
import { triggerHaptic } from "../utils/haptics";
import { printOrderInvoice } from "../utils/invoiceGenerator";
import { ReturnRequestModal } from "../components/ReturnRequestModal";
import { fetchOrderReturnsMap } from "../services/returnService";
import type { Order, OrderItem, OrderEvent, Product, ReturnRequest } from "@urbanrat/shared";
import {
  Package,
  CheckCircle2,
  ShoppingBag,
  Loader2,
  Calendar,
  Copy,
  Check,
  MessageCircle,
  FileText,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Search,
  ShieldCheck,
  Sparkles,
  ExternalLink,
} from "lucide-react";

export interface OrderPageProps {
  onAddToCart?: (product: Product, quantity?: number) => void;
}

interface TimelineMilestone {
  key: string;
  label: string;
  description?: string;
  timestamp?: string;
  note?: string;
  completed: boolean;
  current: boolean;
  isSpecialState?: "cancelled" | "returned";
}

export function OrderPage({ onAddToCart }: OrderPageProps) {
  const { orderId } = useParams<{ orderId?: string }>();
  const navigate = useNavigate();
  const { settings, whatsappNumber } = useSettings();
  const { user } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Collapsible cards state (both expanded by default as in Flipkart design)
  const [deliveryOpen, setDeliveryOpen] = useState(true);
  const [priceOpen, setPriceOpen] = useState(true);
  const [showAllUpdates, setShowAllUpdates] = useState(false);

  // Copy feedback
  const [copiedId, setCopiedId] = useState(false);

  // Toast message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Return / Report Issue modal
  const [reportModalOpen, setReportModalOpen] = useState(false);

  // Existing return request for this order (if any)
  const [existingReturn, setExistingReturn] = useState<ReturnRequest | null>(null);

  // Guest order lookup input (if no orderId in route or not found)
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupError, setLookupError] = useState<string | null>(null);

  const loadOrder = useCallback(async () => {
    if (!orderId || !orderId.trim()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [data, returnsMap] = await Promise.all([
        fetchOrderById(orderId.trim()),
        fetchOrderReturnsMap().catch(() => ({} as Record<string, ReturnRequest>)),
      ]);
      setOrder(data);
      if (data && returnsMap) {
        setExistingReturn(returnsMap[data.id] || null);
      }
    } catch (err: unknown) {
      console.error("Failed to load order:", err);
      const e = err as Error;
      setError(e.message || "Failed to retrieve order details.");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }

  function handleCopyOrderId(idToCopy: string) {
    triggerHaptic("selection");
    navigator.clipboard.writeText(idToCopy);
    setCopiedId(true);
    showToast(`Order ID #${idToCopy} copied to clipboard`);
    setTimeout(() => setCopiedId(false), 2000);
  }

  const [copiedUpi, setCopiedUpi] = useState(false);
  const upiId = settings?.upi_id || "7000947033-1@okbizaxis";

  function handleCopyUpi() {
    triggerHaptic("selection");
    navigator.clipboard.writeText(upiId);
    setCopiedUpi(true);
    showToast(`UPI ID ${upiId} copied to clipboard`);
    setTimeout(() => setCopiedUpi(false), 2000);
  }

  function handleQuickLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!lookupQuery.trim()) {
      setLookupError("Please enter a valid order code");
      triggerHaptic("heavy");
      return;
    }
    setLookupError(null);
    triggerHaptic("light");
    navigate(`/order/${lookupQuery.trim()}`);
  }

  function handleReorderAll() {
    if (!order) return;
    triggerHaptic("success");

    if (!onAddToCart) {
      navigate("/cart");
      return;
    }

    let totalAdded = 0;
    for (const item of order.items) {
      const productMock: Product = {
        id: item.product_id,
        name: item.name,
        slug: item.product_id,
        description: "",
        sku: item.sku || null,
        mrp: item.mrp || item.unit_price || item.price || 999,
        price: item.unit_price || item.price || 999,
        images: item.image ? [item.image] : [],
        category_id: null,
        is_urbanrat_brand: true,
        is_active: true,
        is_featured: false,
        stock: 999,
        price_tiers: [],
        rating_avg: 4.8,
        rating_count: 15,
        created_at: new Date().toISOString(),
      };
      onAddToCart(productMock, item.quantity);
      totalAdded += item.quantity;
    }

    showToast(`Added ${totalAdded} items from order #${order.id} to cart`);
    setTimeout(() => {
      navigate("/cart");
    }, 700);
  }

  function handleReorderSingleItem(item: OrderItem) {
    triggerHaptic("success");
    if (!onAddToCart) {
      navigate("/cart");
      return;
    }

    const productMock: Product = {
      id: item.product_id,
      name: item.name,
      slug: item.product_id,
      description: "",
      sku: item.sku || null,
      mrp: item.mrp || item.unit_price || item.price || 999,
      price: item.unit_price || item.price || 999,
      images: item.image ? [item.image] : [],
      category_id: null,
      is_urbanrat_brand: true,
      is_active: true,
      is_featured: false,
      stock: 999,
      price_tiers: [],
      rating_avg: 4.8,
      rating_count: 15,
      created_at: new Date().toISOString(),
    };
    onAddToCart(productMock, item.quantity);
    showToast(`Added ${item.name} (${item.quantity} pcs) to cart`);
  }

  function handleDownloadInvoice() {
    if (!order) return;
    triggerHaptic("light");
    printOrderInvoice(order, settings);
  }

  // Calculate order milestone timeline
  const timelineMilestones = useMemo<TimelineMilestone[]>(() => {
    if (!order) return [];

    const events: OrderEvent[] = order.events || order.order_events || [];
    const status = (order.status || "pending").toLowerCase();

    // Map of events by status
    const eventMap = new Map<string, OrderEvent>();
    for (const ev of events) {
      eventMap.set(ev.status.toLowerCase(), ev);
    }

    // Special handling for cancelled
    if (status === "cancelled") {
      const placedEv = eventMap.get("pending") || eventMap.get("placed");
      const cancelEv = eventMap.get("cancelled");
      return [
        {
          key: "placed",
          label: "Order Placed",
          timestamp: placedEv
            ? new Date(placedEv.created_at).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : new Date(order.created_at).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              }),
          note: placedEv?.note || undefined,
          completed: true,
          current: false,
        },
        {
          key: "cancelled",
          label: "Order Cancelled",
          timestamp: cancelEv
            ? new Date(cancelEv.created_at).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : undefined,
          note: cancelEv?.note || order.cancel_reason || "Cancelled as requested",
          completed: true,
          current: true,
          isSpecialState: "cancelled",
        },
      ];
    }

    // Special handling for returned
    if (status === "returned") {
      const placedEv = eventMap.get("pending") || eventMap.get("placed");
      const deliveredEv = eventMap.get("delivered");
      const returnedEv = eventMap.get("returned");
      return [
        {
          key: "placed",
          label: "Order Placed",
          timestamp: placedEv
            ? new Date(placedEv.created_at).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : new Date(order.created_at).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              }),
          completed: true,
          current: false,
        },
        {
          key: "delivered",
          label: "Delivered",
          timestamp: deliveredEv
            ? new Date(deliveredEv.created_at).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : undefined,
          completed: true,
          current: false,
        },
        {
          key: "returned",
          label: "Replacement / Return Completed",
          timestamp: returnedEv
            ? new Date(returnedEv.created_at).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : undefined,
          note: returnedEv?.note || "Replacement request verified and fulfilled.",
          completed: true,
          current: true,
          isSpecialState: "returned",
        },
      ];
    }

    // Canonical progression: Placed -> Confirmed -> Processing -> Shipped -> Delivered
    const sequence = ["pending", "confirmed", "processing", "shipped", "delivered"];
    const statusLabels: Record<string, string> = {
      pending: "Order Placed",
      confirmed: "Order Confirmed",
      processing: "Packing & Quality Verification",
      shipped: "Dispatched / In Transit",
      delivered: "Delivered",
    };

    const currentIndex = sequence.indexOf(status);
    const activeIndex = currentIndex === -1 ? 0 : currentIndex;

    return sequence.map((stepKey, idx) => {
      const isCompleted = idx <= activeIndex;
      const isCurrent = idx === activeIndex;

      // Check if there is an explicit recorded event
      const matchedEv =
        eventMap.get(stepKey) ||
        (stepKey === "pending" ? eventMap.get("placed") : undefined);

      let stepTimestamp: string | undefined = undefined;
      if (matchedEv) {
        stepTimestamp = new Date(matchedEv.created_at).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      } else if (idx === 0) {
        stepTimestamp = new Date(order.created_at).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
      }

      return {
        key: stepKey,
        label: statusLabels[stepKey] || stepKey,
        timestamp: stepTimestamp,
        note: matchedEv?.note || (stepKey === "shipped" && order.admin_note ? order.admin_note : undefined),
        completed: isCompleted,
        current: isCurrent,
      };
    });
  }, [order]);

  // Return window calculation (configurable via store_settings.return_window_days)
  const returnWindowDays = settings?.return_window_days ?? 7;
  const returnInfo = useMemo(() => {
    if (!order || order.status.toLowerCase() !== "delivered") {
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
    return {
      isDelivered: true,
      isWithinWindow: diffDays <= returnWindowDays,
      daysRemaining: Math.max(0, returnWindowDays - diffDays),
    };
  }, [order, returnWindowDays]);

  // Loading state
  if (loading) {
    return (
      <div className="py-24 text-center space-y-4 max-w-lg mx-auto">
        <Loader2 className="w-9 h-9 text-brand-dark animate-spin mx-auto" />
        <p className="text-sm font-bold text-slate-800">Loading Order Details...</p>
        <p className="text-xs text-slate-500">Retrieving wholesale shipment status and tracking timeline</p>
      </div>
    );
  }

  // Error state or lookup without ID
  if (!orderId || error || !order) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-4 space-y-8 animate-in fade-in">
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-sm space-y-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-100">
            <Package className="w-7 h-7" />
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {orderId ? "Order Not Found" : "Track Wholesale Order"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-2 max-w-md mx-auto">
              {orderId
                ? `We couldn't locate an active order with code #${orderId}. Check your SMS confirmation or enter your order code below.`
                : "Enter your 6-digit or full order tracking code to view live delivery timeline and download invoices."}
            </p>
          </div>

          <form onSubmit={handleQuickLookup} className="max-w-md mx-auto space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={lookupQuery}
                onChange={(e) => {
                  setLookupQuery(e.target.value);
                  setLookupError(null);
                }}
                placeholder="Enter Order Code (e.g. 748291 or OD432970)"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 outline-none focus:border-brand-dark focus:bg-white transition"
              />
            </div>
            {lookupError && (
              <p className="text-xs text-rose-600 font-semibold text-left pl-1">
                {lookupError}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-3 px-5 rounded-2xl bg-brand-dark hover:bg-brand-dark/90 text-white font-bold text-xs sm:text-sm shadow-md transition active:scale-[0.99] flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Search className="w-4 h-4" />
              <span>Track Order</span>
            </button>
          </form>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-center space-x-6 text-xs text-slate-500">
            <Link
              to="/my-orders"
              className="text-brand-dark font-bold hover:underline inline-flex items-center space-x-1"
            >
              <span>View My Orders List</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
            <span>&bull;</span>
            <Link
              to="/marketplace"
              className="text-slate-600 font-semibold hover:text-slate-900"
            >
              Browse Catalog
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // WhatsApp Inquiry Link
  const targetWhatsApp = whatsappNumber || "919999999999";
  const whatsappUrl = `https://wa.me/${targetWhatsApp.replace(/\D/g, "")}?text=${encodeURIComponent(
    `Hello URT Wholesale Support, I have a query regarding my Order #${order.id}. Could you please check the status for me?`
  )}`;

  // Formatted Placed Date
  const formattedOrderDate = new Date(order.created_at).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Price calculations
  const subtotal = order.subtotal || order.total;
  const savings = order.savings || 0;
  const shipping = order.shipping || 0;
  const total = order.total;

  // Approximate GST (Wholesale: 18% GST included, broken down as 9% CGST + 9% SGST)
  const taxableBase = Math.round((subtotal / 1.18) * 100) / 100;
  const gstAmount = Math.round((subtotal - taxableBase) * 100) / 100;
  const cgst = Math.round((gstAmount / 2) * 100) / 100;
  const sgst = Math.round((gstAmount / 2) * 100) / 100;

  // Primary item vs other items
  const primaryItem = order.items?.[0];
  const otherItems = order.items?.slice(1) || [];

  // Order status configuration
  const statusConfigMap: Record<
    string,
    { label: string; bg: string; text: string; dot: string; border: string }
  > = {
    pending: {
      label: "Order Placed",
      bg: "bg-amber-50",
      text: "text-amber-800",
      dot: "bg-amber-500",
      border: "border-amber-200",
    },
    confirmed: {
      label: "Order Confirmed",
      bg: "bg-blue-50",
      text: "text-blue-800",
      dot: "bg-blue-500",
      border: "border-blue-200",
    },
    processing: {
      label: "In Processing & Quality Check",
      bg: "bg-purple-50",
      text: "text-purple-800",
      dot: "bg-purple-500",
      border: "border-purple-200",
    },
    shipped: {
      label: "Dispatched / In Transit",
      bg: "bg-indigo-50",
      text: "text-indigo-800",
      dot: "bg-indigo-500",
      border: "border-indigo-200",
    },
    delivered: {
      label: "Delivered",
      bg: "bg-emerald-50",
      text: "text-emerald-800",
      dot: "bg-emerald-500",
      border: "border-emerald-200",
    },
    cancelled: {
      label: "Cancelled",
      bg: "bg-rose-50",
      text: "text-rose-800",
      dot: "bg-rose-500",
      border: "border-rose-200",
    },
    returned: {
      label: "Replacement / Returned",
      bg: "bg-amber-50",
      text: "text-amber-900",
      dot: "bg-amber-500",
      border: "border-amber-200",
    },
  };

  const fallbackStatus = {
    label: "Order Placed",
    bg: "bg-amber-50",
    text: "text-amber-800",
    dot: "bg-amber-500",
    border: "border-amber-200",
  };

  const statusConfig =
    statusConfigMap[order.status.toLowerCase()] || fallbackStatus;

  // Check customer ownership if logged in with a different user ID
  if (user && order.user_id && order.user_id !== user.id) {
    return (
      <div className="max-w-md mx-auto py-12 px-4 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <Package className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900">Order Belongs to Another Account</h2>
        <p className="text-xs text-slate-500">
          This order was placed under a different wholesale customer account. Please switch accounts or track as a guest.
        </p>
        <Link
          to="/my-orders"
          className="inline-block px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
        >
          View My Orders
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5 animate-in fade-in duration-300 pb-20">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-18 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-xs font-semibold text-white shadow-xl animate-in fade-in slide-in-from-top-2 bg-slate-900 flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Breadcrumb Navigation (Flipkart Marketplace Style) ── */}
      <nav className="flex items-center space-x-1.5 text-xs text-slate-500 overflow-x-auto py-1">
        <Link to="/" className="hover:text-slate-900 transition shrink-0">
          Home
        </Link>
        <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />
        <Link to="/account" className="hover:text-slate-900 transition shrink-0">
          My Account
        </Link>
        <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />
        <Link to="/my-orders" className="hover:text-slate-900 transition shrink-0">
          My Orders
        </Link>
        <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />
        <span className="font-bold text-slate-900 truncate shrink-0">
          OD{order.id}
        </span>
      </nav>

      {/* ── Return / Replacement Banner (Requirement 5) ── */}
      {existingReturn && (
        <div
          className={`p-4 sm:p-5 rounded-3xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs animate-in fade-in ${
            existingReturn.status === "refunded"
              ? "bg-emerald-50/90 border-emerald-200 text-emerald-950"
              : existingReturn.status === "rejected"
              ? "bg-rose-50/90 border-rose-200 text-rose-950"
              : existingReturn.type === "replacement" &&
                existingReturn.status === "closed"
              ? "bg-teal-50/90 border-teal-200 text-teal-950"
              : "bg-amber-50/90 border-amber-200 text-amber-950"
          }`}
        >
          <div className="flex items-start sm:items-center space-x-3.5">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                existingReturn.status === "refunded"
                  ? "bg-emerald-100 text-emerald-700"
                  : existingReturn.status === "rejected"
                  ? "bg-rose-100 text-rose-700"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-black text-sm">
                  {existingReturn.status === "refunded"
                    ? "Refund Processed"
                    : existingReturn.type === "replacement" &&
                      existingReturn.status === "closed"
                    ? "Replacement Consignment Completed"
                    : existingReturn.status === "rejected"
                    ? "Return Request Rejected"
                    : existingReturn.type === "replacement"
                    ? "Replacement Request In Progress"
                    : "Return Request In Progress"}
                </span>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-white/80 border border-current">
                  {existingReturn.return_code}
                </span>
              </div>
              <p className="text-xs opacity-85 mt-0.5">
                Current status:{" "}
                <strong className="capitalize">
                  {existingReturn.status.replace(/_/g, " ")}
                </strong>{" "}
                &bull; Requested on{" "}
                {new Date(existingReturn.requested_at).toLocaleDateString(
                  "en-IN",
                  { day: "numeric", month: "short", year: "numeric" }
                )}
              </p>
            </div>
          </div>

          <Link
            to={`/returns/${existingReturn.id}`}
            onClick={() => triggerHaptic("selection")}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-white text-slate-900 font-bold text-xs border border-slate-200 shadow-2xs hover:bg-slate-50 transition self-start sm:self-auto cursor-pointer"
          >
            <span>Track Return</span>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </Link>
        </div>
      )}

      {/* ── Top Header / Quick Action Bar ── */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3 flex-wrap gap-y-1">
            <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
              <span>Order #{order.id}</span>
              <button
                type="button"
                onClick={() => handleCopyOrderId(order.id)}
                title="Copy Order ID"
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
              >
                {copiedId ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </h1>

            <span
              className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold ${statusConfig.bg} ${statusConfig.text} border ${statusConfig.border}`}
            >
              <span className={`w-2 h-2 rounded-full ${statusConfig.dot}`} />
              <span>{statusConfig.label}</span>
            </span>
          </div>

          <p className="text-xs text-slate-500 mt-1 flex items-center space-x-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>Placed on {formattedOrderDate}</span>
            <span className="text-slate-300">&bull;</span>
            <span className="font-semibold text-slate-700">
              {order.items?.length || 0} wholesale item
              {(order.items?.length || 0) > 1 ? "s" : ""}
            </span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center flex-wrap gap-2 pt-2 md:pt-0">
          <button
            type="button"
            onClick={handleReorderAll}
            className="flex-1 sm:flex-none inline-flex items-center justify-center space-x-1.5 py-2 px-3.5 rounded-xl bg-brand-dark hover:bg-brand-dark/90 text-white font-bold text-xs shadow-xs transition active:scale-[0.99] cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reorder All</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadInvoice}
            className="flex-1 sm:flex-none inline-flex items-center justify-center space-x-1.5 py-2 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition active:scale-[0.99] cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span>Tax Invoice</span>
          </button>

          {/* Return / Replace Action Button (Requirement 1 & 5) */}
          {existingReturn ? (
            <Link
              to={`/returns/${existingReturn.id}`}
              onClick={() => triggerHaptic("selection")}
              className="flex-1 sm:flex-none inline-flex items-center justify-center space-x-1.5 py-2 px-3.5 rounded-xl bg-sky-50 text-sky-900 border border-sky-200 font-bold text-xs transition active:scale-[0.99] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-sky-700" />
              <span>View Return ({existingReturn.return_code})</span>
            </Link>
          ) : returnInfo.isDelivered ? (
            returnInfo.isWithinWindow ? (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("selection");
                  setReportModalOpen(true);
                }}
                className="flex-1 sm:flex-none inline-flex items-center justify-center space-x-1.5 py-2 px-3.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold text-xs transition active:scale-[0.99] cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                <span>Return / Replace</span>
                <span className="text-[10px] text-amber-700 font-normal">
                  ({returnInfo.daysRemaining}d left)
                </span>
              </button>
            ) : (
              <span className="flex-1 sm:flex-none inline-flex items-center justify-center space-x-1.5 py-2 px-3.5 rounded-xl bg-slate-100 text-slate-400 font-medium text-xs select-none">
                <RotateCcw className="w-3.5 h-3.5 text-slate-300" />
                <span>Return window closed</span>
              </span>
            )
          ) : null}
        </div>
      </div>

      {/* ── Two Column Layout (Flipkart Model) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ── Left / Main Column (Items, Timeline, Support) ── */}
        <div className="lg:col-span-8 space-y-5">
          {/* Main Focused Product Card (Screenshot 2 Model) */}
          {primaryItem && (
            <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                <div className="space-y-1.5 min-w-0 flex-1">
                  {/* Status Badge */}
                  <span className="inline-block px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-black text-[10px] uppercase tracking-wider">
                    {order.status === "returned"
                      ? "REPLACEMENT / RETURN"
                      : "PRIMARY PRODUCT"}
                  </span>

                  <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                    {primaryItem.name}
                  </h2>

                  <div className="flex items-center space-x-3 text-xs text-slate-500 flex-wrap gap-y-1">
                    {primaryItem.sku && (
                      <span>
                        SKU: <strong className="text-slate-800">{primaryItem.sku}</strong>
                      </span>
                    )}
                    {primaryItem.tier_min_qty && (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 font-bold text-[11px] border border-sky-100">
                        <Sparkles className="w-3 h-3 text-sky-600" />
                        <span>Tier applied: {primaryItem.tier_min_qty}+ pcs</span>
                      </span>
                    )}
                    <span>
                      Seller: <strong className="text-slate-800">URT Direct</strong>
                    </span>
                  </div>

                  <div className="pt-1 flex items-baseline space-x-2">
                    <span className="text-lg font-black text-slate-900">
                      ₹
                      {(
                        primaryItem.unit_price ||
                        primaryItem.price ||
                        0
                      ).toLocaleString("en-IN")}
                    </span>
                    <span className="text-xs text-slate-500">
                      per unit &bull; Qty: <strong>{primaryItem.quantity}</strong> (Total: ₹
                      {(
                        primaryItem.line_total ||
                        (primaryItem.unit_price || primaryItem.price || 0) *
                          primaryItem.quantity
                      ).toLocaleString("en-IN")}
                      )
                    </span>
                  </div>
                </div>

                {/* Product Thumbnail */}
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-center overflow-hidden shrink-0">
                  {primaryItem.image ? (
                    <img
                      src={primaryItem.image}
                      alt={primaryItem.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className="w-8 h-8 text-slate-300" />
                  )}
                </div>
              </div>

              {/* ── Vertical Timeline (Screenshot 2: Green connected line) ── */}
              <div className="pt-4 border-t border-slate-100 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Order Progression
                </h3>

                <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-2.75 sm:before:left-3.75 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {timelineMilestones.map((step) => {
                    const isCompleted = step.completed;
                    const isCurrent = step.current;

                    return (
                      <div key={step.key} className="relative flex items-start space-x-3">
                        {/* Dot / Icon */}
                        <div
                          className={`absolute -left-6 sm:-left-8 top-0.5 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                            step.isSpecialState === "cancelled"
                              ? "bg-rose-600 text-white shadow-sm"
                              : step.isSpecialState === "returned"
                              ? "bg-amber-500 text-white shadow-sm"
                              : isCompleted
                              ? "bg-emerald-600 text-white shadow-sm"
                              : isCurrent
                              ? "bg-white border-2 border-emerald-600 text-emerald-600 animate-pulse"
                              : "bg-white border-2 border-slate-300 text-slate-300"
                          }`}
                        >
                          {isCompleted ? (
                            <Check className="w-3.5 h-3.5 stroke-3" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          )}
                        </div>

                        {/* Step Details */}
                        <div className="min-w-0 flex-1 pt-0.5">
                          <div className="flex items-baseline justify-between flex-wrap gap-x-2">
                            <p
                              className={`text-xs sm:text-sm font-bold ${
                                isCompleted
                                  ? "text-slate-900"
                                  : "text-slate-500"
                              }`}
                            >
                              {step.label}
                            </p>
                            {step.timestamp && (
                              <span className="text-[11px] text-slate-500 font-medium">
                                {step.timestamp}
                              </span>
                            )}
                          </div>

                          {step.note && (
                            <p className="text-xs text-slate-600 mt-0.5 bg-slate-50 p-2 rounded-xl border border-slate-100">
                              {step.note}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* "See All Updates >" Toggle */}
                {order.events && order.events.length > 2 && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAllUpdates(!showAllUpdates)}
                      className="text-xs font-bold text-brand-dark hover:text-brand-dark/90 inline-flex items-center space-x-1 cursor-pointer"
                    >
                      <span>
                        {showAllUpdates ? "Hide Updates" : "See All Updates"}
                      </span>
                      <ChevronRight
                        className={`w-3.5 h-3.5 transition-transform ${
                          showAllUpdates ? "rotate-90" : ""
                        }`}
                      />
                    </button>

                    {showAllUpdates && (
                      <div className="mt-3 p-3 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-2">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Full Activity Log
                        </p>
                        {order.events.map((ev, i) => (
                          <div
                            key={i}
                            className="flex items-start justify-between text-xs py-1.5 border-b border-slate-100 last:border-none"
                          >
                            <div>
                              <span className="font-bold text-slate-800 capitalize">
                                {ev.status}
                              </span>
                              {ev.note && (
                                <p className="text-[11px] text-slate-600 mt-0.5">
                                  {ev.note}
                                </p>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-500 font-medium shrink-0 ml-2">
                              {new Date(ev.created_at).toLocaleString("en-IN", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Chat with us WhatsApp banner (Screenshot 2) */}
              <div className="pt-4 border-t border-slate-100">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/80 text-emerald-900 transition group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <MessageCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-emerald-950 flex items-center space-x-1.5">
                        <span>Chat with us on WhatsApp</span>
                      </p>
                      <p className="text-[11px] text-emerald-700">
                        Have a question regarding Order #{order.id}? Connect with our support team
                      </p>
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-emerald-600 group-hover:translate-x-0.5 transition-transform shrink-0" />
                </a>
              </div>
            </div>
          )}

          {/* ── Additional Items in this Order (if any) ── */}
          {otherItems.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs space-y-4">
              <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
                <ShoppingBag className="w-4 h-4 text-brand-dark" />
                <h3 className="font-extrabold text-sm text-slate-900">
                  Other Items In This Order ({otherItems.length})
                </h3>
              </div>

              <div className="divide-y divide-slate-100">
                {otherItems.map((item, idx) => {
                  const unitPrice = item.unit_price || item.price || 0;
                  const lineTotal = item.line_total || unitPrice * item.quantity;

                  return (
                    <div
                      key={idx}
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-center overflow-hidden shrink-0">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="w-6 h-6 text-slate-300" />
                          )}
                        </div>

                        <div className="min-w-0 space-y-0.5">
                          <p className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                            {item.name}
                          </p>
                          <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                            {item.sku && <span>SKU: {item.sku}</span>}
                            <span>&bull;</span>
                            <span>Qty: <strong>{item.quantity}</strong></span>
                            {item.tier_min_qty && (
                              <span className="text-sky-700 font-semibold">
                                ({item.tier_min_qty}+ tier)
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-black text-slate-900 sm:hidden pt-0.5">
                            ₹{lineTotal.toLocaleString("en-IN")}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end space-x-3 shrink-0 pt-2 sm:pt-0">
                        <div className="text-right hidden sm:block">
                          <p className="text-xs text-slate-400">
                            ₹{unitPrice.toLocaleString("en-IN")} × {item.quantity}
                          </p>
                          <p className="font-black text-sm text-slate-900">
                            ₹{lineTotal.toLocaleString("en-IN")}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleReorderSingleItem(item)}
                          className="py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
                        >
                          + Reorder Item
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Right Column (Collapsible Details - Screenshot 2) ── */}
        <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-24">
          {/* ── Delivery Details Card ── */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden transition">
            <button
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                setDeliveryOpen(!deliveryOpen);
              }}
              className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-slate-50/50 transition cursor-pointer"
            >
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">
                  Delivery details
                </h3>
                {order.customer && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Delivered to {order.customer.name}
                  </p>
                )}
              </div>
              <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                {deliveryOpen ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </div>
            </button>

            {deliveryOpen && (
              <div className="px-5 pb-5 pt-1 border-t border-slate-100 text-xs space-y-3">
                {order.customer ? (
                  <div className="space-y-2 text-slate-600">
                    <div>
                      <p className="font-bold text-slate-900 text-xs sm:text-sm">
                        {order.customer.name}
                      </p>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        +91 {order.customer.phone}
                      </p>
                    </div>

                    <div className="pt-1 text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <p className="font-medium">{order.customer.address}</p>
                      {order.customer.pincode && (
                        <p className="font-bold text-slate-900 mt-1">
                          PIN Code: {order.customer.pincode}
                        </p>
                      )}
                    </div>

                    {(order.customer.business_name || order.customer.gstin) && (
                      <div className="pt-2 border-t border-slate-100 space-y-1">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Wholesale Entity
                        </p>
                        {order.customer.business_name && (
                          <p className="font-semibold text-slate-800">
                            {order.customer.business_name}
                          </p>
                        )}
                        {order.customer.gstin && (
                          <p className="text-[11px] font-mono text-slate-600">
                            GSTIN: <span className="font-bold">{order.customer.gstin}</span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-500 italic">
                    Recipient details provided at checkout.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── UPI Payment & QR Code Card ── */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-sm">
                  ₹
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Pay via UPI / QR Code
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Scan &amp; pay with any UPI app
                  </p>
                </div>
              </div>
              <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/60">
                ₹{total.toLocaleString("en-IN")}
              </span>
            </div>

            {/* QR Code image */}
            <div className="flex flex-col items-center justify-center p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-2">
              <div className="w-48 sm:w-52 h-auto rounded-xl overflow-hidden shadow-xs border border-slate-200 bg-white">
                <img
                  src="/payment-qr.png"
                  alt="Ajay Wholesale Mobile Accessories UPI QR Code"
                  className="w-full h-auto object-contain"
                />
              </div>
              <p className="text-[11px] font-semibold text-slate-500 text-center">
                Google Pay &bull; PhonePe &bull; Paytm &bull; BHIM UPI
              </p>
            </div>

            {/* UPI ID copy box */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                UPI ID for Payment
              </label>
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2">
                <span className="text-xs font-mono font-bold text-slate-800 truncate mr-2">
                  {upiId}
                </span>
                <button
                  type="button"
                  onClick={handleCopyUpi}
                  className="shrink-0 text-xs font-bold text-brand-dark hover:text-brand-dark/80 flex items-center space-x-1 cursor-pointer transition"
                >
                  {copiedUpi ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600 text-[11px]">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-slate-600 text-[11px]">Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Direct Pay with UPI App button */}
            <a
              href={`upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent("Ajay Wholesale Mobile Accessories")}&am=${total}&cu=INR`}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md transition active:scale-[0.99]"
            >
              <span>Pay ₹{total.toLocaleString("en-IN")} via UPI App</span>
            </a>
          </div>

          {/* ── Price Details Card ── */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden transition">
            <button
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                setPriceOpen(!priceOpen);
              }}
              className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-slate-50/50 transition cursor-pointer"
            >
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">
                  Price details
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Paid ₹{total.toLocaleString("en-IN")}
                </p>
              </div>
              <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                {priceOpen ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </div>
            </button>

            {priceOpen && (
              <div className="px-5 pb-5 pt-1 border-t border-slate-100 text-xs space-y-3">
                <div className="space-y-2 text-slate-600">
                  <div className="flex justify-between">
                    <span>Items Subtotal</span>
                    <span className="font-semibold text-slate-800">
                      ₹{subtotal.toLocaleString("en-IN")}
                    </span>
                  </div>

                  {savings > 0 && (
                    <div className="flex justify-between text-emerald-600 font-semibold">
                      <span>Wholesale Volume Savings</span>
                      <span>-₹{savings.toLocaleString("en-IN")}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-slate-500 text-[11px]">
                    <span>Taxable Base Value</span>
                    <span>₹{taxableBase.toLocaleString("en-IN")}</span>
                  </div>

                  <div className="flex justify-between text-slate-500 text-[11px]">
                    <span>CGST (9%)</span>
                    <span>₹{cgst.toLocaleString("en-IN")}</span>
                  </div>

                  <div className="flex justify-between text-slate-500 text-[11px]">
                    <span>SGST (9%)</span>
                    <span>₹{sgst.toLocaleString("en-IN")}</span>
                  </div>

                  <div className="flex justify-between">
                    <span>Shipping Fee</span>
                    <span className="font-semibold text-emerald-600">
                      {shipping > 0 ? `₹${shipping}` : "FREE"}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-between items-baseline">
                  <span className="font-black text-sm text-slate-900">
                    Total Amount
                  </span>
                  <span className="text-lg font-black text-slate-900">
                    ₹{total.toLocaleString("en-IN")}
                  </span>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleDownloadInvoice}
                    className="w-full py-2.5 px-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center space-x-2 transition cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-600" />
                    <span>Download Tax Invoice (PDF)</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Wholesale Help & Assistance Box ── */}
          <div className="bg-slate-50/80 rounded-3xl border border-slate-200/70 p-4 space-y-2.5 text-xs text-slate-600">
            <div className="flex items-center space-x-2 text-slate-900 font-bold">
              <ShieldCheck className="w-4 h-4 text-brand-dark" />
              <span>1-Year URT Wholesale Warranty</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              All bulk purchases are covered under our direct replacement guarantee.
              For damages or shortages, report within 7 days of delivery.
            </p>
            <div className="pt-1 flex items-center space-x-2">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-dark font-bold hover:underline inline-flex items-center space-x-1 text-xs"
              >
                <span>Wholesale Resolution Desk</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ── Return / Replacement Flow Modal ── */}
      <ReturnRequestModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        order={order}
        onSuccess={() => {
          loadOrder();
        }}
      />
    </div>
  );
}
