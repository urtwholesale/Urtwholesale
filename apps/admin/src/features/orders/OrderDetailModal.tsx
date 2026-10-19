import { useState, useEffect } from "react";
import type { Order } from "@urbanrat/shared";
import {
  adminUpdateOrderStatus,
  fetchOrderEvents,
  type OrderEvent,
} from "../../lib/adminService";
import {
  X,
  AlertTriangle,
  Check,
  Loader2,
  Calendar,
  MapPin,
  History,
} from "lucide-react";

interface OrderDetailModalProps {
  order: Order;
  onClose: () => void;
  onUpdated: () => void;
}

const ALLOWED_STATUSES: {
  value: "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded";
  label: string;
}[] = [
  { value: "pending", label: "Pending Verification" },
  { value: "confirmed", label: "Order Confirmed" },
  { value: "processing", label: "Processing & QC Boxing" },
  { value: "shipped", label: "Shipped / In Transit" },
  { value: "delivered", label: "Delivered to Customer" },
  { value: "cancelled", label: "Cancelled (Restores Stock)" },
  { value: "refunded", label: "Refunded (Restores Stock)" },
];

export function OrderDetailModal({
  order,
  onClose,
  onUpdated,
}: OrderDetailModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<
    "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded"
  >(order.status as any);
  const [statusNote, setStatusNote] = useState("");
  const [updating, setUpdating] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  useEffect(() => {
    fetchOrderEvents(order.id)
      .then(setEvents)
      .catch(console.error)
      .finally(() => setLoadingEvents(false));
  }, [order.id]);

  async function handleStatusChange(e: React.FormEvent) {
    e.preventDefault();
    if (selectedStatus === order.status && !statusNote) return;

    setUpdating(true);
    setError(null);
    setUpdateSuccess(null);

    try {
      // Status update MUST go strictly through admin_update_order_status RPC
      const res = await adminUpdateOrderStatus(
        order.id,
        selectedStatus,
        statusNote.trim() || undefined
      );

      const restoreNotice =
        res.items_restored > 0
          ? ` (${res.items_restored} item units automatically restored to stock)`
          : "";

      setUpdateSuccess(`Status transitioned to "${selectedStatus}" successfully!${restoreNotice}`);
      setStatusNote("");
      onUpdated();

      // Refresh events
      fetchOrderEvents(order.id).then(setEvents).catch(console.error);
    } catch (err: any) {
      console.error("Status update error:", err);
      setError(err?.message || "Failed to update order status via RPC.");
    } finally {
      setUpdating(false);
    }
  }

  const statusColors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    confirmed: "bg-blue-100 text-blue-800",
    processing: "bg-purple-100 text-purple-800",
    shipped: "bg-indigo-100 text-indigo-800",
    delivered: "bg-emerald-100 text-emerald-800",
    cancelled: "bg-rose-100 text-rose-800",
    refunded: "bg-slate-200 text-slate-800",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col my-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-black text-slate-900">
                Order #{order.id}
              </h3>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  statusColors[order.status] || "bg-slate-100 text-slate-700"
                }`}
              >
                {order.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center space-x-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>{new Date(order.created_at).toLocaleString("en-IN")}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {error}
            </div>
          )}

          {updateSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center space-x-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{updateSuccess}</span>
            </div>
          )}

          {/* ── 1. Status Transition Form (Strict RPC) ── */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
              Update Order Lifecycle Status (RPC)
            </h4>

            <form onSubmit={handleStatusChange} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">
                    Select New Status
                  </label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-[#5ADBE5]"
                  >
                    {ALLOWED_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">
                    Status Event Note (Optional)
                  </label>
                  <input
                    type="text"
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    placeholder="e.g. Courier tracking AWB #3948291"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#5ADBE5]"
                  />
                </div>
              </div>

              {(selectedStatus === "cancelled" || selectedStatus === "refunded") && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold flex items-center space-x-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Moving to &quot;{selectedStatus}&quot; will automatically restore all ordered item quantities back to stock in the database.
                  </span>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={updating || selectedStatus === order.status}
                  className="px-4 py-2 rounded-xl text-white text-xs font-bold shadow transition active:scale-95 disabled:opacity-40 cursor-pointer flex items-center space-x-1.5"
                  style={{
                    background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)",
                  }}
                >
                  {updating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating via RPC...</span>
                    </>
                  ) : (
                    <span>Transition Status</span>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* ── 2. Ordered Items Snapshot ── */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
              Items Ordered ({order.items?.length || 0})
            </h4>

            <div className="space-y-2">
              {order.items?.map((item: any, idx: number) => {
                const name = item.product?.name ?? item.name ?? "Item";
                const unitPrice = item.unit_price ?? item.price ?? 0;
                const qty = item.quantity;
                const lineTotal = item.line_total ?? unitPrice * qty;

                return (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl bg-slate-50/70 border border-slate-100 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-900">{name}</p>
                      <p className="text-[11px] text-slate-500">
                        Qty: <span className="font-black">{qty}</span> × ₹
                        {unitPrice.toLocaleString("en-IN")}/pc
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="font-black text-slate-900">
                        ₹{lineTotal.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── 3. Customer & Financial Summary ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Customer Details */}
            <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-xs space-y-2 text-xs">
              <div className="flex items-center space-x-1.5 text-slate-400 font-bold uppercase text-[10px]">
                <MapPin className="w-3.5 h-3.5" />
                <span>Destination Coordinates</span>
              </div>
              <div className="space-y-1">
                <p className="font-bold text-slate-900">{order.customer?.name}</p>
                <p className="font-mono text-slate-600">+91 {order.customer?.phone}</p>
                <p className="text-slate-500 leading-relaxed font-normal">
                  {order.customer?.address}
                  {order.customer?.pincode && `, PIN: ${order.customer?.pincode}`}
                </p>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-xs space-y-2 text-xs">
              <span className="text-slate-400 font-bold uppercase text-[10px] block">
                Order Financials
              </span>
              <div className="space-y-1 text-slate-600">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-bold text-slate-900">
                    ₹{(order.subtotal || order.total).toLocaleString("en-IN")}
                  </span>
                </div>
                {order.savings !== undefined && order.savings > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Wholesale Margin:</span>
                    <span>-₹{order.savings.toLocaleString("en-IN")}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Shipping:</span>
                  <span className="font-semibold text-emerald-600">
                    {order.shipping ? `₹${order.shipping}` : "FREE"}
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-100 font-black text-sm text-slate-900">
                  <span>Total Amount:</span>
                  <span>₹{order.total.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── 4. Order Events Timeline (Audit Log) ── */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center space-x-1.5 text-slate-400 font-bold uppercase text-[10px]">
              <History className="w-3.5 h-3.5" />
              <span>Order Lifecycle Audit Events ({events.length})</span>
            </div>

            {loadingEvents ? (
              <div className="p-4 text-center text-xs text-slate-400">
                Loading order audit events...
              </div>
            ) : events.length > 0 ? (
              <div className="space-y-2">
                {events.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-100/80 text-xs flex items-start justify-between"
                  >
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-slate-800">
                          {ev.event_type}
                        </span>
                        {ev.to_status && (
                          <span className="text-[10px] font-semibold text-slate-500">
                            → {ev.to_status}
                          </span>
                        )}
                      </div>
                      {ev.note && (
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          {ev.note}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {new Date(ev.created_at).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No events logged yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
