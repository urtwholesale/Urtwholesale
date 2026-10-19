import { useState, useEffect, useCallback } from "react";
import type { Order } from "@urbanrat/shared";
import { fetchAdminOrders } from "../../lib/adminService";
import { OrderDetailModal } from "./OrderDetailModal";
import {
  Search,
  RefreshCw,
  Loader2,
  Eye,
} from "lucide-react";

const STATUS_TABS = [
  { value: "all", label: "All Orders" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
  { value: "refunded", label: "Refunded" },
];

export function OrderList() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminOrders({
        status: selectedStatus,
        search,
      });
      setOrders(data);
    } catch (err: any) {
      console.error("Failed to fetch admin orders:", err);
      setError(err?.message || "Failed to load orders from Supabase.");
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, search]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

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
    <div className="space-y-6">
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
            Order Fulfillment &amp; Invoices
          </h2>
          <p className="text-xs text-slate-400">
            {orders.length} orders matching current filter
          </p>
        </div>

        <button
          type="button"
          onClick={loadOrders}
          aria-label="Refresh orders"
          className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#0A82A8]" : ""}`} />
        </button>
      </div>

      {/* ── Search and Status Filter Tabs ── */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-xs space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order ID (URT-...), customer name, or 10-digit mobile..."
            className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#5ADBE5]"
          />
        </div>

        {/* Status Tabs */}
        <div className="flex space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setSelectedStatus(tab.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                selectedStatus === tab.value
                  ? "bg-[#0A82A8] text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={loadOrders}
            className="px-3 py-1 rounded-lg bg-rose-600 text-white font-bold"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Orders Table ── */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
        {loading && orders.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 flex items-center justify-center space-x-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#0A82A8]" />
            <span>Loading orders from database...</span>
          </div>
        ) : orders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 text-[10px] uppercase font-bold bg-slate-50/50">
                  <th className="py-3 px-4">Order ID</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Items</th>
                  <th className="py-3 px-3">Total Amount</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((ord) => (
                  <tr
                    key={ord.id}
                    onClick={() => setSelectedOrder(ord)}
                    className="hover:bg-slate-50/60 transition cursor-pointer"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      #{ord.id}
                    </td>

                    <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                      {new Date(ord.created_at).toLocaleDateString("en-IN", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>

                    <td className="py-3 px-3">
                      <div>
                        <p className="font-bold text-slate-900">
                          {ord.customer?.name || "Customer"}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono">
                          {ord.customer?.phone ? `+91 ${ord.customer.phone}` : "—"}
                        </p>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-slate-600 font-semibold">
                      {ord.items?.length || 0} {ord.items?.length === 1 ? "item" : "items"}
                    </td>

                    <td className="py-3 px-3 font-black text-slate-900 text-sm">
                      ₹{ord.total.toLocaleString("en-IN")}
                    </td>

                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          statusColors[ord.status] || "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {ord.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOrder(ord);
                        }}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-xs text-slate-400">
            No orders match the selected status or query.
          </div>
        )}
      </div>

      {/* ── Order Detail Modal ── */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdated={() => {
            loadOrders();
          }}
        />
      )}
    </div>
  );
}
