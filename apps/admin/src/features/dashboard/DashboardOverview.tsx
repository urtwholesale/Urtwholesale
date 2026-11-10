import { useState, useEffect, useCallback, useMemo } from "react";
import {
  fetchDashboardStats,
  fetchSalesByDay,
  fetchOrdersByStatus,
  fetchTopProducts,
  type DashboardStats,
  type DailySale,
  type StatusDistribution,
  type TopProduct,
} from "../../lib/adminService";
import {
  DashboardPartyDetailModal,
  type DashboardDrilldownConfig,
} from "./DashboardPartyDetailModal";
import {
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Clock,
  AlertTriangle,
  Users,
  RefreshCw,
  Package,
  ChevronRight,
  Sparkles,
} from "lucide-react";

interface DashboardOverviewProps {
  onSelectOrder?: (orderId: string) => void;
  onNavigateTab?: (tab: any) => void;
}

export function DashboardOverview({ onSelectOrder, onNavigateTab }: DashboardOverviewProps = {}) {
  const [daysRange, setDaysRange] = useState<number>(30);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [sales, setSales] = useState<DailySale[]>([]);
  const [statuses, setStatuses] = useState<StatusDistribution[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active Drilldown for Party-Wise Detailed View
  const [drilldownConfig, setDrilldownConfig] = useState<DashboardDrilldownConfig | null>(null);

  // Compute active date range string
  const { fromStr, toStr } = useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - daysRange + 1);
    return {
      fromStr: from.toISOString().split("T")[0]!,
      toStr: to.toISOString().split("T")[0]!,
    };
  }, [daysRange]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [statsRes, salesRes, statusesRes, topRes] = await Promise.all([
        fetchDashboardStats(fromStr, toStr),
        fetchSalesByDay(fromStr, toStr),
        fetchOrdersByStatus(fromStr, toStr),
        fetchTopProducts(fromStr, toStr, 5),
      ]);

      setStats(statsRes);
      setSales(salesRes);
      setStatuses(statusesRes);
      setTopProducts(topRes);
    } catch (err: any) {
      console.error("Dashboard RPC fetch error:", err);
      setError(err?.message || "Failed to load dashboard data from Supabase RPCs.");
    } finally {
      setLoading(false);
    }
  }, [fromStr, toStr]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  function calculateTrend(curr: number, prev: number): { text: string; positive: boolean } {
    if (prev === 0) {
      return curr > 0 ? { text: "+100%", positive: true } : { text: "0%", positive: true };
    }
    const diff = Math.round(((curr - prev) / prev) * 100);
    return {
      text: `${diff >= 0 ? "+" : ""}${diff}%`,
      positive: diff >= 0,
    };
  }

  return (
    <div className="space-y-6">
      {/* ── Top Bar with Date Range Selector & Interactive Explainer ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Executive Analytics &amp; Sales Performance
            </h2>
            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
              <Sparkles className="w-2.5 h-2.5" />
              <span>Interactive Party Drilldown</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Computed in real-time via Postgres analytical RPCs • Click any card or row to view detailed party-wise breakdowns
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setDaysRange(7)}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                daysRange === 7
                  ? "bg-white text-primary shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              7 Days
            </button>
            <button
              type="button"
              onClick={() => setDaysRange(30)}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                daysRange === 30
                  ? "bg-white text-primary shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              30 Days
            </button>
            <button
              type="button"
              onClick={() => setDaysRange(90)}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                daysRange === 90
                  ? "bg-white text-primary shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              90 Days
            </button>
          </div>

          <button
            type="button"
            onClick={loadDashboard}
            disabled={loading}
            aria-label="Refresh metrics"
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-primary" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
            <span className="font-semibold">{error}</span>
          </div>
          <button
            type="button"
            onClick={loadDashboard}
            className="px-3 py-1 rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-700 transition cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Primary Metric KPI Cards from admin_dashboard_stats (ALL CLICKABLE FOR PARTY DRILLDOWN) ── */}
      {loading && !stats ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 bg-white rounded-2xl border border-slate-100 p-4 animate-pulse space-y-2">
              <div className="h-3 bg-slate-100 rounded w-1/2" />
              <div className="h-6 bg-slate-200 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* 1. Revenue Card */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setDrilldownConfig({ type: "revenue" })}
            className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between hover:border-emerald-300 hover:shadow-md cursor-pointer transition active:scale-[0.98] group relative"
            title="Click to view Party-Wise Revenue & Collections Breakdown"
          >
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Revenue</span>
              <DollarSign className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition" />
            </div>
            <div className="mt-2">
              <span className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                ₹{Number(stats.current.revenue || 0).toLocaleString("en-IN")}
              </span>
              {stats.current.paid_revenue !== undefined && (
                <p className="text-[10px] text-emerald-700 font-bold mt-0.5">
                  ₹{Number(stats.current.paid_revenue || 0).toLocaleString("en-IN")} collected (Paid)
                </p>
              )}
              <div className="flex items-center space-x-1 mt-0.5">
                <span
                  className={`text-[10px] font-bold ${
                    calculateTrend(stats.current.revenue, stats.previous.revenue).positive
                      ? "text-emerald-600"
                      : "text-rose-500"
                  }`}
                >
                  {calculateTrend(stats.current.revenue, stats.previous.revenue).text}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">vs prev</span>
              </div>
            </div>
            <div className="pt-2 mt-2 border-t border-slate-100/80 flex items-center justify-between text-[9px] font-bold text-emerald-700 group-hover:underline">
              <span>Party ledger breakdown</span>
              <ChevronRight className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition" />
            </div>
          </div>

          {/* 2. Orders Count Card */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setDrilldownConfig({ type: "orders" })}
            className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between hover:border-primary/40 hover:shadow-md cursor-pointer transition active:scale-[0.98] group relative"
            title="Click to view Party-Wise Orders Breakdown"
          >
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Orders</span>
              <ShoppingBag className="w-4 h-4 text-primary group-hover:scale-110 transition" />
            </div>
            <div className="mt-2">
              <span className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                {stats.current.order_count}
              </span>
              {stats.current.paid_order_count !== undefined && (
                <p className="text-[10px] text-emerald-700 font-bold mt-0.5">
                  {stats.current.paid_order_count} Paid orders
                </p>
              )}
              <div className="flex items-center space-x-1 mt-0.5">
                <span
                  className={`text-[10px] font-bold ${
                    calculateTrend(stats.current.order_count, stats.previous.order_count).positive
                      ? "text-emerald-600"
                      : "text-rose-500"
                  }`}
                >
                  {calculateTrend(stats.current.order_count, stats.previous.order_count).text}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">vs prev</span>
              </div>
            </div>
            <div className="pt-2 mt-2 border-t border-slate-100/80 flex items-center justify-between text-[9px] font-bold text-primary group-hover:underline">
              <span>Party consignments</span>
              <ChevronRight className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition" />
            </div>
          </div>

          {/* 3. Average Order Value (AOV) Card */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setDrilldownConfig({ type: "avg_order" })}
            className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between hover:border-purple-300 hover:shadow-md cursor-pointer transition active:scale-[0.98] group relative"
            title="Click to view Party-Wise Average Order Value & Ticket Size Tiers"
          >
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Avg Order</span>
              <TrendingUp className="w-4 h-4 text-purple-600 group-hover:scale-110 transition" />
            </div>
            <div className="mt-2">
              <span className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                ₹{Number(stats.current.avg_order_value || 0).toLocaleString("en-IN")}
              </span>
              <div className="flex items-center space-x-1 mt-0.5">
                <span
                  className={`text-[10px] font-bold ${
                    calculateTrend(stats.current.avg_order_value, stats.previous.avg_order_value).positive
                      ? "text-emerald-600"
                      : "text-rose-500"
                  }`}
                >
                  {calculateTrend(stats.current.avg_order_value, stats.previous.avg_order_value).text}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">vs prev</span>
              </div>
            </div>
            <div className="pt-2 mt-2 border-t border-slate-100/80 flex items-center justify-between text-[9px] font-bold text-purple-700 group-hover:underline">
              <span>Party purchasing tiers</span>
              <ChevronRight className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition" />
            </div>
          </div>

          {/* 4. Pending Orders Card */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setDrilldownConfig({ type: "pending" })}
            className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between hover:border-amber-300 hover:shadow-md cursor-pointer transition active:scale-[0.98] group relative"
            title="Click to view Party-Wise Pending Dispatch Orders"
          >
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Pending</span>
              <Clock className="w-4 h-4 text-amber-500 group-hover:scale-110 transition" />
            </div>
            <div className="mt-2">
              <span className="text-lg sm:text-xl font-black text-amber-600 tracking-tight">
                {stats.current.pending_count}
              </span>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                Require dispatch action
              </p>
            </div>
            <div className="pt-2 mt-2 border-t border-slate-100/80 flex items-center justify-between text-[9px] font-bold text-amber-700 group-hover:underline">
              <span>Pending party actions</span>
              <ChevronRight className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition" />
            </div>
          </div>

          {/* 5. Low Stock Threshold Alerts Card */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setDrilldownConfig({ type: "low_stock" })}
            className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between hover:border-rose-300 hover:shadow-md cursor-pointer transition active:scale-[0.98] group relative"
            title="Click to view Low Stock Products & Restock Alerts"
          >
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Low Stock</span>
              <AlertTriangle className="w-4 h-4 text-rose-500 group-hover:scale-110 transition" />
            </div>
            <div className="mt-2">
              <span className="text-lg sm:text-xl font-black text-rose-600 tracking-tight">
                {stats.current.low_stock_count}
              </span>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                Below threshold levels
              </p>
            </div>
            <div className="pt-2 mt-2 border-t border-slate-100/80 flex items-center justify-between text-[9px] font-bold text-rose-700 group-hover:underline">
              <span>Restock alerts</span>
              <ChevronRight className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition" />
            </div>
          </div>

          {/* 6. New Customer Registrations Card */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setDrilldownConfig({ type: "new_buyers" })}
            className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between hover:border-sky-300 hover:shadow-md cursor-pointer transition active:scale-[0.98] group relative"
            title="Click to view Party-Wise New Customer Registrations"
          >
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">New Buyers</span>
              <Users className="w-4 h-4 text-sky-600 group-hover:scale-110 transition" />
            </div>
            <div className="mt-2">
              <span className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                {stats.current.new_customers}
              </span>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                Profiles registered
              </p>
            </div>
            <div className="pt-2 mt-2 border-t border-slate-100/80 flex items-center justify-between text-[9px] font-bold text-sky-700 group-hover:underline">
              <span>New party profiles</span>
              <ChevronRight className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition" />
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Two-Column Breakdown: Daily Sales Timeline + Status Distribution ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Daily Sales Trend from admin_sales_by_day (CLICKABLE ROWS FOR PARTY DRILLDOWN) */}
        <div className="lg:col-span-8 bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">
                Daily Sales &amp; Dispatch Volume
              </h3>
              <p className="text-[11px] text-slate-400">
                Generated via admin_sales_by_day RPC • Click any date row to inspect party orders placed on that day
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              {sales.length} Days Recorded
            </span>
          </div>

          {sales.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 text-[10px] uppercase font-bold">
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Orders</th>
                    <th className="pb-2 text-right">Daily Revenue</th>
                    <th className="pb-2 text-right">Volume Share</th>
                    <th className="pb-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {sales.slice(-10).reverse().map((row) => {
                    const maxRev = Math.max(...sales.map((s) => s.revenue), 1);
                    const percentage = Math.round((row.revenue / maxRev) * 100);

                    return (
                      <tr
                        key={row.sale_date}
                        onClick={() => setDrilldownConfig({ type: "daily_sale", date: row.sale_date })}
                        className="hover:bg-primary/5 transition cursor-pointer group"
                        title="Click to view party-wise orders placed on this date"
                      >
                        <td className="py-2.5 font-mono text-slate-700 font-medium flex items-center space-x-1.5">
                          <span className="group-hover:text-primary font-bold">
                            {new Date(row.sale_date).toLocaleDateString("en-IN", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </td>
                        <td className="py-2.5 font-bold text-slate-800">
                          {row.order_count}
                        </td>
                        <td className="py-2.5 font-black text-slate-900 text-right">
                          ₹{row.revenue.toLocaleString("en-IN")}
                        </td>
                        <td className="py-2.5 text-right w-32">
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${percentage}%`,
                                background: "var(--color-primary)",
                              }}
                            />
                          </div>
                        </td>
                        <td className="py-2.5 text-right">
                          <span className="inline-flex items-center text-[10px] font-bold text-primary group-hover:underline">
                            <span>Parties</span>
                            <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-6">
              No sales records during this window.
            </p>
          )}
        </div>

        {/* Status Distribution from admin_orders_by_status (CLICKABLE FOR PARTY DRILLDOWN) */}
        <div className="lg:col-span-4 bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4">
          <div>
            <h3 className="font-extrabold text-sm text-slate-900">
              Orders by Status
            </h3>
            <p className="text-[11px] text-slate-400">
              Lifecycle status aggregation • Click any status to view party-wise orders
            </p>
          </div>

          <div className="space-y-2">
            {statuses.map((item) => {
              const statusColors: Record<string, string> = {
                pending: "bg-amber-500",
                confirmed: "bg-blue-500",
                processing: "bg-purple-500",
                shipped: "bg-indigo-500",
                delivered: "bg-emerald-500",
                cancelled: "bg-rose-500",
                refunded: "bg-slate-500",
              };

              return (
                <div
                  key={item.status}
                  onClick={() => setDrilldownConfig({ type: "status", status: item.status })}
                  className="p-3 rounded-2xl bg-slate-50/70 hover:bg-white hover:border-primary/40 hover:shadow-xs border border-slate-100 flex items-center justify-between cursor-pointer transition active:scale-[0.98] group"
                  title={`Click to view party-wise ${item.status} orders`}
                >
                  <div className="flex items-center space-x-2">
                    <span className={`w-2 h-2 rounded-full ${statusColors[item.status] || "bg-slate-400"}`} />
                    <span className="text-xs font-bold capitalize text-slate-800 group-hover:text-primary transition">
                      {item.status}
                    </span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <span className="text-xs font-black text-slate-900">
                        {item.order_count} {item.order_count === 1 ? "order" : "orders"}
                      </span>
                      <p className="text-[10px] text-slate-400 font-medium">
                        ₹{Number(item.total_amount || 0).toLocaleString("en-IN")}
                      </p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-primary group-hover:translate-x-0.5 transition" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Top Selling Products from admin_top_products (CLICKABLE TO VIEW BUYER PARTIES) ── */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-sm text-slate-900">
              Top Selling Wholesale Products
            </h3>
            <p className="text-[11px] text-slate-400">
              Extracted from orders.items via admin_top_products RPC • Click any product to view which parties bought this SKU
            </p>
          </div>
        </div>

        {topProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            {topProducts.map((p, idx) => (
              <div
                key={p.product_id || idx}
                onClick={() =>
                  setDrilldownConfig({
                    type: "product_buyers",
                    productId: p.product_id,
                    productName: p.name,
                  })
                }
                className="p-3 rounded-2xl bg-slate-50/60 hover:bg-white hover:border-primary/40 hover:shadow-md border border-slate-100 flex flex-col justify-between space-y-3 cursor-pointer transition active:scale-[0.98] group"
                title={`Click to view party buyers for ${p.name}`}
              >
                <div className="flex items-center space-x-2.5">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                    {p.image ? (
                      <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition" />
                    ) : (
                      <Package className="w-4 h-4 text-slate-300" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-slate-900 truncate group-hover:text-primary transition">
                      {p.name}
                    </h4>
                    <p className="text-[10px] text-slate-400">
                      {p.total_quantity} pcs shipped
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[10px] text-slate-400 font-medium">Revenue</span>
                  <span className="font-black text-slate-900">
                    ₹{Number(p.total_revenue || 0).toLocaleString("en-IN")}
                  </span>
                </div>

                <div className="text-[9px] font-bold text-primary group-hover:underline flex items-center justify-between">
                  <span>View party buyers</span>
                  <ChevronRight className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 text-center py-6">
            No top product sales recorded yet.
          </p>
        )}
      </div>

      {/* ── Active Party Drilldown Modal ── */}
      {drilldownConfig && (
        <DashboardPartyDetailModal
          config={drilldownConfig}
          fromDate={fromStr}
          toDate={toStr}
          onClose={() => setDrilldownConfig(null)}
          onSelectOrder={onSelectOrder}
          onNavigateTab={onNavigateTab}
        />
      )}
    </div>
  );
}
