import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router";
import { fetchOrderById } from "../services/storeService";
import { useSettings } from "../context/SettingsContext";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import type { Order } from "@urbanrat/shared";
import {
  Package,
  MapPin,
  MessageCircle,
  CreditCard,
  Clock,
  CheckCircle2,
  Truck,
  ShoppingBag,
  Loader2,
  Calendar,
  AlertTriangle,
} from "lucide-react";

export function OrderPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { whatsappNumber } = useSettings();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrder = useCallback(async () => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOrderById(orderId.trim());
      setOrder(data);
    } catch (err: any) {
      console.error("Failed to load order:", err);
      setError(err?.message || "Failed to retrieve order details.");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  if (loading) {
    return (
      <div className="py-24 text-center space-y-3">
        <Loader2 className="w-8 h-8 text-[#0A82A8] animate-spin mx-auto" />
        <p className="text-xs font-semibold text-slate-500">Loading order details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12">
        <ErrorState
          title="Could not load order"
          message={error}
          onRetry={loadOrder}
        />
      </div>
    );
  }

  // Not Found State
  if (!order) {
    return (
      <div className="py-8">
        <EmptyState
          icon={<AlertTriangle className="w-8 h-8 text-amber-500" />}
          title="Order Not Found"
          description={`We couldn't locate an order with ID #${orderId || "unknown"}. Please check your link or contact support.`}
          actionText="Explore Marketplace"
          onAction={() => (window.location.href = "/marketplace")}
        />
      </div>
    );
  }

  const statusColors: Record<string, { bg: string; text: string; icon: typeof Clock }> = {
    pending: { bg: "bg-amber-100", text: "text-amber-800", icon: Clock },
    confirmed: { bg: "bg-blue-100", text: "text-blue-800", icon: CheckCircle2 },
    processing: { bg: "bg-purple-100", text: "text-purple-800", icon: Package },
    shipped: { bg: "bg-indigo-100", text: "text-indigo-800", icon: Truck },
    delivered: { bg: "bg-emerald-100", text: "text-emerald-800", icon: CheckCircle2 },
    cancelled: { bg: "bg-rose-100", text: "text-rose-800", icon: AlertTriangle },
  };

  const statusConfig = statusColors[order.status] || statusColors.pending!;
  const StatusIcon = statusConfig.icon;

  const orderDate = new Date(order.created_at).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const whatsappInquiryUrl = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
        `Hello URT Wholesale, I would like to inquire about my order #${order.id}.`
      )}`
    : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-16">
      {/* ── Order Header Banner ── */}
      <div className="bg-white rounded-3xl border border-slate-100 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Order #{order.id}
            </h1>
            <span
              className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${statusConfig.bg} ${statusConfig.text}`}
            >
              <StatusIcon className="w-3.5 h-3.5" />
              <span>{order.status}</span>
            </span>
          </div>

          <p className="text-xs text-slate-500 mt-1 flex items-center space-x-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>Placed on {orderDate}</span>
          </p>
        </div>

        {whatsappInquiryUrl && (
          <a
            href={whatsappInquiryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-bold text-xs border border-emerald-200/80 transition"
          >
            <MessageCircle className="w-4 h-4 text-emerald-600" />
            <span>Track on WhatsApp</span>
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── Left Column: Items & Customer Details ── */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          {/* Order Items List */}
          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs space-y-4">
            <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
              <ShoppingBag className="w-4 h-4 text-[#0A82A8]" />
              <h2 className="font-extrabold text-sm text-slate-900">
                Ordered Items ({order.items?.length || 0})
              </h2>
            </div>

            <div className="space-y-3">
              {order.items?.map((item: any, idx: number) => {
                const name = item.product?.name ?? item.name ?? "Item";
                const unitPrice = item.unit_price ?? item.price ?? 0;
                const qty = item.quantity;
                const lineTotal = item.line_total ?? unitPrice * qty;
                const img = item.product?.images?.[0] ?? item.images?.[0] ?? "";

                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/70 border border-slate-100/80"
                  >
                    <div className="flex items-center space-x-3 min-w-0 pr-2">
                      <div className="w-12 h-12 rounded-xl bg-white border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                        {img ? (
                          <img
                            src={img}
                            alt={name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="w-5 h-5 text-slate-300" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-slate-900 truncate">
                          {name}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Qty: <span className="font-bold">{qty}</span> × ₹
                          {unitPrice.toLocaleString("en-IN")}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-black text-xs sm:text-sm text-slate-900">
                        ₹{lineTotal.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Delivery Coordinates */}
          {order.customer && (
            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs space-y-3">
              <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
                <MapPin className="w-4 h-4 text-[#0A82A8]" />
                <h2 className="font-extrabold text-sm text-slate-900">
                  Delivery Destination
                </h2>
              </div>

              <div className="text-xs space-y-1.5 text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-400">Recipient Name:</span>
                  <span className="font-semibold text-slate-900">{order.customer.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Mobile Phone:</span>
                  <span className="font-semibold text-slate-900">+91 {order.customer.phone}</span>
                </div>
                <div className="flex justify-between items-start pt-1">
                  <span className="text-slate-400 shrink-0 mr-2">Address:</span>
                  <span className="font-medium text-slate-800 text-right">
                    {order.customer.address}
                    {order.customer.pincode && `, PIN: ${order.customer.pincode}`}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right Column: Order Summary & Actions ── */}
        <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-24 space-y-4">
          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs space-y-4">
            <h2 className="font-bold text-base text-slate-900">Payment Summary</h2>

            <div className="space-y-2 text-xs text-slate-600 border-b border-slate-100 pb-3">
              <div className="flex justify-between">
                <span>Items Subtotal</span>
                <span className="font-semibold text-slate-800">
                  ₹{(order.subtotal || order.total).toLocaleString("en-IN")}
                </span>
              </div>

              {order.savings !== undefined && order.savings > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Wholesale Margin Savings</span>
                  <span className="font-semibold">
                    -₹{order.savings.toLocaleString("en-IN")}
                  </span>
                </div>
              )}

              <div className="flex justify-between">
                <span>Shipping</span>
                <span className="font-semibold text-emerald-600">
                  {order.shipping ? `₹${order.shipping}` : "FREE"}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-baseline pt-1">
              <span className="font-bold text-sm text-slate-900">Total Amount</span>
              <span className="text-xl font-black text-slate-900">
                ₹{order.total.toLocaleString("en-IN")}
              </span>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                disabled
                className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-2xl bg-slate-200 text-slate-500 font-bold text-xs sm:text-sm cursor-not-allowed opacity-80"
                title="Direct online payment gateway integration coming soon"
              >
                <CreditCard className="w-4 h-4" />
                <span>Pay Now (Direct Payment Coming Soon)</span>
              </button>

              {whatsappInquiryUrl && (
                <a
                  href={whatsappInquiryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md transition active:scale-[0.99]"
                >
                  <MessageCircle className="w-4.5 h-4.5" />
                  <span>Chat on WhatsApp</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
