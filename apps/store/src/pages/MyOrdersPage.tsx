import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router";
import { fetchCustomerOrders } from "../services/storeService";
import { supabase } from "../lib/supabase";
import { useSettings } from "../context/SettingsContext";
import { triggerHaptic } from "../utils/haptics";
import { CustomerAuth } from "../features/auth/CustomerAuth";
import type { Order } from "@urbanrat/shared";
import type { User } from "@supabase/supabase-js";
import {
  ArrowLeft,
  Package,
  Search,
  Clock,
  CheckCircle2,
  Truck,
  RotateCcw,
  Copy,
  Check,
  ChevronRight,
  ShoppingBag,
  MessageCircle,
  FileText,
  User as UserIcon,
} from "lucide-react";

export function MyOrdersPage() {
  const navigate = useNavigate();
  const { whatsappNumber } = useSettings();

  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status Filter: "all" | "active" | "delivered" | "cancelled"
  const [filter, setFilter] = useState<"all" | "active" | "delivered" | "cancelled">("all");

  // Guest Quick Order Lookup input
  const [lookupOrderId, setLookupOrderId] = useState("");
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Copy tracking feedback
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  // Show auth modal/tab toggle
  const [showAuth, setShowAuth] = useState(false);

  // Load authenticated user and their orders
  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: authData } = await supabase.auth.getUser();
      setUser(authData?.user ?? null);

      if (authData?.user) {
        const userOrders = await fetchCustomerOrders();
        setOrders(userOrders);
      } else {
        setOrders([]);
      }
    } catch (err: any) {
      console.error("Failed to load customer orders:", err);
      setError(err?.message || "Failed to load orders. Please retry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadOrders();
      } else {
        setOrders([]);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadOrders]);

  function handleCopyOrderId(orderId: string) {
    triggerHaptic("selection");
    navigator.clipboard.writeText(orderId);
    setCopiedOrderId(orderId);
    setTimeout(() => setCopiedOrderId(null), 2000);
  }

  function handleLookupSubmit(e: React.FormEvent) {
    e.preventDefault();
    triggerHaptic("selection");
    const clean = lookupOrderId.trim().toUpperCase();
    if (!clean) {
      setLookupError("Please enter a valid Order ID");
      return;
    }
    setLookupError(null);
    navigate(`/order/${clean}`);
  }

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    if (filter === "all") return true;
    if (filter === "active") {
      return ["pending", "confirmed", "processing", "shipped"].includes(order.status);
    }
    if (filter === "delivered") {
      return order.status === "delivered";
    }
    if (filter === "cancelled") {
      return ["cancelled", "refunded"].includes(order.status);
    }
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-in fade-in duration-300">
      {/* ── Top Header Navigation ── */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            triggerHaptic("selection");
            navigate(-1);
          }}
          className="inline-flex items-center space-x-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200/80 px-3 py-1.5 rounded-full shadow-2xs hover:bg-slate-50 transition cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>

        <div className="flex items-center space-x-2">
          {user ? (
            <button
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                setShowAuth(!showAuth);
              }}
              className="text-xs font-bold text-slate-700 bg-white border border-slate-200 px-3 py-1.5 rounded-full hover:bg-slate-50 transition flex items-center space-x-1.5 cursor-pointer shadow-2xs"
            >
              <UserIcon className="w-3.5 h-3.5 text-brand-dark" />
              <span>My Account</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                setShowAuth(!showAuth);
              }}
              className="text-xs font-bold text-white bg-brand-gradient px-3.5 py-1.5 rounded-full shadow-2xs hover:opacity-95 transition flex items-center space-x-1.5 cursor-pointer"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Log In to View Saved Orders</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Page Hero Title Card ── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand-light/15 text-brand-dark border border-brand-light/30 mb-2">
            Order Tracking &amp; Invoices
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            My Orders &amp; Invoices
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Track real-time carrier dispatch updates, view GST breakdowns, and download receipts.
          </p>
        </div>

        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-700 shrink-0 shadow-2xs">
          <Package className="w-7 h-7" />
        </div>
      </div>

      {/* ── Collapsible Account Login / Profile Box ── */}
      {showAuth && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
          <CustomerAuth
            onAuthSuccess={() => {
              setShowAuth(false);
              loadOrders();
            }}
          />
        </div>
      )}

      {/* ── Guest Quick Order Lookup Card ── */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-sm font-black text-slate-900 flex items-center space-x-2">
              <Search className="w-4 h-4 text-brand-dark" />
              <span>Have an Order ID? Quick Track</span>
            </h2>
            <p className="text-[11px] text-slate-500">
              Placed an order as a guest? Enter your Order ID (e.g., URT-261019-XXXX) to track status immediately.
            </p>
          </div>

          <form
            onSubmit={handleLookupSubmit}
            className="flex items-center space-x-2 w-full md:w-auto"
          >
            <input
              type="text"
              placeholder="e.g. URT-261019-ABCD"
              value={lookupOrderId}
              onChange={(e) => {
                setLookupOrderId(e.target.value);
                setLookupError(null);
              }}
              className="flex-1 md:w-64 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand-dark"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-brand-dark hover:bg-brand transition shrink-0 cursor-pointer shadow-2xs"
            >
              Track Order
            </button>
          </form>
        </div>

        {lookupError && (
          <p className="text-xs font-semibold text-rose-600 mt-2">{lookupError}</p>
        )}
      </div>

      {/* ── Logged-in Orders Section ── */}
      {user ? (
        <div className="space-y-4">
          {/* Filter Pills */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-1">
            {[
              { key: "all", label: `All Orders (${orders.length})` },
              {
                key: "active",
                label: `In Progress (${
                  orders.filter((o) =>
                    ["pending", "confirmed", "processing", "shipped"].includes(o.status)
                  ).length
                })`,
              },
              {
                key: "delivered",
                label: `Delivered (${
                  orders.filter((o) => o.status === "delivered").length
                })`,
              },
              {
                key: "cancelled",
                label: `Cancelled (${
                  orders.filter((o) => ["cancelled", "refunded"].includes(o.status)).length
                })`,
              },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  triggerHaptic("selection");
                  setFilter(tab.key as any);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  filter === tab.key
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200/80 hover:bg-slate-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Loading Skeleton */}
          {loading && (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-3xl border border-slate-200/80 p-5 space-y-3 animate-pulse"
                >
                  <div className="flex items-center justify-between">
                    <div className="h-4 bg-slate-100 rounded w-32" />
                    <div className="h-5 bg-slate-100 rounded w-20" />
                  </div>
                  <div className="h-12 bg-slate-50 rounded-2xl" />
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between">
              <span>{error}</span>
              <button
                type="button"
                onClick={loadOrders}
                className="font-bold underline cursor-pointer ml-2"
              >
                Retry
              </button>
            </div>
          )}

          {/* Orders List */}
          {!loading && filteredOrders.length > 0 && (
            <div className="space-y-4">
              {filteredOrders.map((order) => {
                const isDelivered = order.status === "delivered";
                const isCancelled = ["cancelled", "refunded"].includes(order.status);
                const isShipped = order.status === "shipped";
                const formattedDate = new Date(order.created_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                const whatsappTrackUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
                  `Hello Urbanrat Support, I would like to track my order ${order.id}.`
                )}`;

                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4 transition hover:border-slate-300"
                  >
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                      <div className="flex items-center space-x-2.5">
                        <span className="font-black text-sm text-slate-900 tracking-tight">
                          {order.id}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyOrderId(order.id)}
                          aria-label="Copy Order ID"
                          className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition cursor-pointer"
                        >
                          {copiedOrderId === order.id ? (
                            <Check className="w-3 h-3 text-emerald-600 stroke-3" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                        <span className="text-[11px] text-slate-400 font-medium">
                          • {formattedDate}
                        </span>
                      </div>

                      {/* Status Badge */}
                      <div>
                        <span
                          className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                            isDelivered
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : isCancelled
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : isShipped
                              ? "bg-sky-50 text-sky-700 border border-sky-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {isDelivered ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : isShipped ? (
                            <Truck className="w-3.5 h-3.5" />
                          ) : isCancelled ? (
                            <RotateCcw className="w-3.5 h-3.5" />
                          ) : (
                            <Clock className="w-3.5 h-3.5" />
                          )}
                          <span>{order.status}</span>
                        </span>
                      </div>
                    </div>

                    {/* Order Items Preview */}
                    <div className="space-y-2">
                      <div className="divide-y divide-slate-100">
                        {order.items.slice(0, 3).map((item, idx) => (
                          <div
                            key={idx}
                            className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center space-x-3 min-w-0 pr-2">
                              {item.image ? (
                                <img
                                  src={item.image}
                                  alt={item.name}
                                  className="w-10 h-10 rounded-xl object-cover border border-slate-100 shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                                  <Package className="w-5 h-5" />
                                </div>
                              )}
                              <div className="truncate">
                                <p className="font-bold text-slate-800 truncate">
                                  {item.name}
                                </p>
                                <p className="text-[11px] text-slate-400">
                                  Qty: {item.quantity} × ₹{item.price.toLocaleString("en-IN")}
                                </p>
                              </div>
                            </div>

                            <span className="font-black text-slate-900 shrink-0">
                              ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                            </span>
                          </div>
                        ))}
                      </div>

                      {order.items.length > 3 && (
                        <p className="text-[11px] font-semibold text-slate-400 pt-1">
                          + {order.items.length - 3} more items in this wholesale shipment
                        </p>
                      )}
                    </div>

                    {/* Footer Row: Total & Action Buttons */}
                    <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-[11px] text-slate-400 font-medium block">
                          Total Invoice Value
                        </span>
                        <div className="flex items-baseline space-x-2">
                          <span className="text-base sm:text-lg font-black text-slate-900">
                            ₹{order.total.toLocaleString("en-IN")}
                          </span>
                          {(order.savings ?? 0) > 0 && (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                              Saved ₹{(order.savings ?? 0).toLocaleString("en-IN")}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <a
                          href={whatsappTrackUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => triggerHaptic("selection")}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center space-x-1.5 transition cursor-pointer"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Help</span>
                        </a>

                        <Link
                          to={`/order/${order.id}`}
                          onClick={() => triggerHaptic("selection")}
                          className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-brand-gradient hover:opacity-95 shadow-2xs flex items-center space-x-1.5 transition cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>View Invoice</span>
                          <ChevronRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty State when logged in but no orders matching filter */}
          {!loading && filteredOrders.length === 0 && (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-8 text-center space-y-3 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                {filter === "all" ? "No orders found in your account" : `No ${filter} orders found`}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Explore our catalog of certified wholesale mobile accessories and factory-direct volume tier deals.
              </p>
              <div className="pt-2">
                <Link
                  to="/marketplace"
                  onClick={() => triggerHaptic("selection")}
                  className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-full text-xs font-bold text-white bg-brand-gradient shadow-2xs hover:opacity-95 transition"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Browse Marketplace</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Guest prompt to log in or register */
        <div className="bg-white rounded-3xl border border-slate-200/80 p-8 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-brand-light/15 text-brand-dark flex items-center justify-center mx-auto">
            <Package className="w-7 h-7" />
          </div>

          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-black text-slate-900 tracking-tight">
              Sign In to View All Account Orders
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Log in with your wholesale credentials to view full purchase history, download GST tax invoices, and track live dispatches across India.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                setShowAuth(true);
              }}
              className="w-full sm:w-auto px-6 py-2.5 rounded-full text-xs font-bold text-white bg-brand-gradient shadow-2xs hover:opacity-95 transition cursor-pointer"
            >
              Sign In / Register
            </button>

            <Link
              to="/marketplace"
              onClick={() => triggerHaptic("selection")}
              className="w-full sm:w-auto px-5 py-2.5 rounded-full text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
            >
              Start Shopping
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
