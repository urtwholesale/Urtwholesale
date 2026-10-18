import { useEffect, useState } from "react";
import { useParams, Link } from "react-router";
import { fetchOrderById } from "../services/storeService";
import type { Order } from "@urbanrat/shared";
import {
  Package,
  MapPin,
  MessageCircle,
  CreditCard,
  ArrowRight,
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
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOrder() {
      if (!orderId) {
        setLoading(false);
        return;
      }
      try {
        const data = await fetchOrderById(orderId.trim());
        setOrder(data);
      } catch (err) {
        console.error("Failed to load order:", err);
      } finally {
        setLoading(false);
      }
    }

    loadOrder();
  }, [orderId]);

  if (loading) {
    return (
      <div className="py-24 text-center space-y-3">
        <Loader2 className="w-8 h-8 text-[#0A82A8] animate-spin mx-auto" />
        <p className="text-xs font-semibold text-slate-500">Loading order details...</p>
      </div>
    );
  }

  // Invalid / Not Found State
  if (!order) {
    return (
      <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 p-8 shadow-sm max-w-md mx-auto my-6 animate-in fade-in duration-300">
        <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 mx-auto mb-4 border border-amber-100">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">Order Not Found</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
          We couldn&apos;t locate an order with ID <span className="font-mono font-bold text-slate-700">#{orderId || "unknown"}</span>. Please verify your link or contact wholesale support.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
          <Link
            to="/marketplace"
            className="inline-flex items-center justify-center space-x-2 py-2.5 px-6 rounded-2xl text-white font-semibold text-xs shadow-md transition active:scale-95"
            style={{
              background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)",
            }}
          >
            <span>Explore Catalog</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="https://wa.me/917000947033?text=Hello%20URT%20Wholesale%2C%20I%20need%20help%20finding%20my%20order"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center space-x-2 py-2.5 px-6 rounded-2xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold text-xs transition"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Support Chat</span>
          </a>
        </div>
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

  const whatsappInquiryUrl = `https://wa.me/917000947033?text=${encodeURIComponent(
    `Hello URT Wholesale, I would like to inquire about my order #${order.id}.`
  )}`;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-16 w-full max-w-5xl 2xl:max-w-6xl mx-auto">
      {/* ── Top Order Header ── */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-400">Order ID</span>
              <span className="font-mono text-sm sm:text-base font-extrabold text-slate-900">
                #{order.id}
              </span>
            </div>
            <div className="flex items-center space-x-1.5 text-[11px] text-slate-500 mt-0.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Placed on {orderDate}</span>
            </div>
          </div>

          <span
            className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${statusConfig.bg} ${statusConfig.text}`}
          >
            <StatusIcon className="w-3.5 h-3.5" />
            <span>{order.status}</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── Left Column: Items List ── */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
              <ShoppingBag className="w-4 h-4 text-[#0A82A8]" />
              <h2 className="font-bold text-sm text-slate-900">
                Ordered Items ({order.items.reduce((s, i) => s + i.quantity, 0)})
              </h2>
            </div>

            <div className="space-y-3">
              {order.items.map((item, index) => (
                <div
                  key={`${item.product_id}-${index}`}
                  className="flex items-center space-x-3.5 p-3 rounded-2xl bg-slate-50/80 border border-slate-100"
                >
                  <div className="w-14 h-14 rounded-xl bg-white overflow-hidden shrink-0 border border-slate-200/70">
                    <img
                      src={item.image || "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=200&auto=format&fit=crop&q=80"}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1 min-w-0 pr-2">
                    <p className="font-semibold text-xs sm:text-sm text-slate-800 truncate">
                      {item.name}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {item.quantity} × ₹{item.price.toLocaleString("en-IN")}
                    </p>
                  </div>

                  <span className="font-bold text-xs sm:text-sm text-slate-900 shrink-0">
                    ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Delivery Details Card */}
          {order.customer && (
            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-3">
              <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
                <MapPin className="w-4 h-4 text-[#0A82A8]" />
                <h2 className="font-bold text-sm text-slate-900">Delivery Information</h2>
              </div>

              <div className="space-y-2 text-xs text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-400">Recipient:</span>
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
          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
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
              {/* Pay Now Button (Disabled placeholder per spec) */}
              <button
                type="button"
                disabled
                className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-2xl bg-slate-200 text-slate-500 font-bold text-xs sm:text-sm cursor-not-allowed opacity-80"
                title="Direct online payment gateway integration coming soon"
              >
                <CreditCard className="w-4 h-4" />
                <span>Pay Now (Direct Payment Coming Soon)</span>
              </button>

              {/* Chat on WhatsApp */}
              <a
                href={whatsappInquiryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md transition active:scale-[0.99]"
              >
                <MessageCircle className="w-4.5 h-4.5" />
                <span>Chat on WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
