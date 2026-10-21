import { useState, useEffect, useCallback, useMemo } from "react";
import type {
  Order,
  OrderStatus,
  OrderNoticeCounts,
  SellerHubTab,
  OrderSource,
  PaymentStatus,
} from "@urbanrat/shared";
import {
  ORDER_STATUS_BADGES,
  filterOrders,
} from "@urbanrat/shared";
import {
  fetchAdminOrders,
  fetchAdminOrderCounts,
  fetchOrderNoticeCounts,
  adminBulkUpdateOrderStatus,
  exportOrdersToExcel,
  exportOrdersToCSV,
} from "../../lib/adminService";
import { OrderDetailModal } from "./OrderDetailModal";
import { OrderNoticesStrip } from "./OrderNoticesStrip";
import { triggerHaptic } from "../../utils/haptics";
import {
  Search,
  RefreshCw,
  Loader2,
  Eye,
  Check,
  Copy,
  Download,
  X,
  Calendar,
  Globe,
  MessageCircle,
  Truck,
  CheckCircle2,
  ChevronDown,
  Package,
} from "lucide-react";

const SELLER_HUB_TABS: { key: SellerHubTab; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "ready_to_ship", label: "Ready to Ship" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
  { key: "on_hold", label: "On Hold" },
  { key: "all", label: "All Orders" },
];

export function OrderList() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab state
  const [selectedTab, setSelectedTab] = useState<SellerHubTab>("pending");

  // Tab Counts & Notices
  const [tabCounts, setTabCounts] = useState<{
    all: number;
    pending: number;
    ready_to_ship: number;
    shipped: number;
    delivered: number;
    cancelled: number;
    on_hold: number;
  }>({
    all: 0,
    pending: 0,
    ready_to_ship: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
    on_hold: 0,
  });

  const [noticeCounts, setNoticeCounts] = useState<OrderNoticeCounts | null>(null);

  // Filters state
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<OrderSource | "all">("all");
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | "all">("all");
  const [dateRangeFilter, setDateRangeFilter] = useState<
    "all" | "today" | "yesterday" | "7_days" | "30_days" | "this_month" | "custom"
  >("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Multi-Selection State (Bulk actions)
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [bulkActionInProgress, setBulkActionInProgress] = useState(false);

  // Download menu dropdown toggle
  const [downloadDropdownOpen, setDownloadDropdownOpen] = useState(false);

  // Selected single order modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Copy feedback
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  // Toast message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [allOrders, counts, notices] = await Promise.all([
        fetchAdminOrders({
          status: "all", // Load all to compute real-time tab counts and allow responsive client filtering
        }),
        fetchAdminOrderCounts(),
        fetchOrderNoticeCounts(),
      ]);

      setOrders(allOrders);
      setTabCounts(counts);
      setNoticeCounts(notices);
    } catch (err: any) {
      console.error("Failed to load seller orders:", err);
      setError(err?.message || "Failed to load orders from Supabase.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Client-filtered orders based on active tab & filters
  const filteredOrders = useMemo(() => {
    return filterOrders(orders, {
      tab: selectedTab,
      search,
      source: sourceFilter,
      paymentStatus: paymentFilter,
      dateRange: dateRangeFilter,
      startDate: customStartDate || undefined,
      endDate: customEndDate || undefined,
    });
  }, [
    orders,
    selectedTab,
    search,
    sourceFilter,
    paymentFilter,
    dateRangeFilter,
    customStartDate,
    customEndDate,
  ]);

  const hasActiveFilters =
    search.trim() !== "" ||
    sourceFilter !== "all" ||
    paymentFilter !== "all" ||
    dateRangeFilter !== "all";

  function clearAllFilters() {
    triggerHaptic("selection");
    setSearch("");
    setSourceFilter("all");
    setPaymentFilter("all");
    setDateRangeFilter("all");
    setCustomStartDate("");
    setCustomEndDate("");
  }

  function handleCopyOrderId(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    triggerHaptic("selection");
    navigator.clipboard.writeText(id);
    setCopiedOrderId(id);
    showToast(`Order ID #${id} copied`);
    setTimeout(() => setCopiedOrderId(null), 2000);
  }

  // ── Multi-Select Checkboxes ──
  const isAllSelected =
    filteredOrders.length > 0 &&
    filteredOrders.every((o) => selectedOrderIds.has(o.id));

  function handleToggleSelectAll() {
    triggerHaptic("selection");
    if (isAllSelected) {
      setSelectedOrderIds(new Set());
    } else {
      const allIds = new Set(filteredOrders.map((o) => o.id));
      setSelectedOrderIds(allIds);
    }
  }

  function handleToggleOrderSelect(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    triggerHaptic("selection");
    const next = new Set(selectedOrderIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedOrderIds(next);
  }

  // ── Bulk Status Update ──
  async function handleBulkStatusTransition(targetStatus: OrderStatus) {
    if (selectedOrderIds.size === 0) return;
    triggerHaptic("medium");

    const ids = Array.from(selectedOrderIds);
    const label = targetStatus.toUpperCase();
    if (!window.confirm(`Mark ${ids.length} selected orders as ${label}?`)) {
      return;
    }

    setBulkActionInProgress(true);
    try {
      const res = await adminBulkUpdateOrderStatus(
        ids,
        targetStatus,
        `Bulk updated to ${targetStatus} via Seller Hub`
      );

      triggerHaptic("success");
      showToast(
        `Successfully marked ${res.succeeded.length} orders as ${targetStatus}${
          res.failed.length > 0 ? ` (${res.failed.length} failed)` : ""
        }`
      );
      setSelectedOrderIds(new Set());
      loadData();
    } catch (err: any) {
      triggerHaptic("heavy");
      showToast(err?.message || "Failed to bulk update orders.");
    } finally {
      setBulkActionInProgress(false);
    }
  }

  // ── SheetJS Exports ──
  function handleExportSelectedExcel() {
    triggerHaptic("light");
    const targetOrders = orders.filter((o) => selectedOrderIds.has(o.id));
    if (targetOrders.length === 0) return;
    exportOrdersToExcel(
      targetOrders,
      `urt_orders_selected_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
    showToast(`Exported ${targetOrders.length} orders to Excel (.xlsx)`);
  }

  function handleExportSelectedCSV() {
    triggerHaptic("light");
    const targetOrders = orders.filter((o) => selectedOrderIds.has(o.id));
    if (targetOrders.length === 0) return;
    exportOrdersToCSV(
      targetOrders,
      `urt_orders_selected_${new Date().toISOString().slice(0, 10)}.csv`
    );
    showToast(`Exported ${targetOrders.length} orders to CSV`);
  }

  function handleExportAllExcel() {
    triggerHaptic("light");
    setDownloadDropdownOpen(false);
    exportOrdersToExcel(
      filteredOrders,
      `urt_orders_${selectedTab}_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
    showToast(`Exported ${filteredOrders.length} orders to Excel`);
  }

  function handleExportAllCSV() {
    triggerHaptic("light");
    setDownloadDropdownOpen(false);
    exportOrdersToCSV(
      filteredOrders,
      `urt_orders_${selectedTab}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    showToast(`Exported ${filteredOrders.length} orders to CSV`);
  }

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-18 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-xs font-semibold text-white shadow-xl animate-in fade-in bg-slate-900 flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Seller Hub Top Header Bar (Matching Meesho Screenshot) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-slate-100 shadow-2xs">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Orders
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
              {tabCounts.all} Total Consignments
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Wholesale order fulfillment, courier AWB tracking &amp; GST tax manifests
          </p>
        </div>

        {/* Right header actions */}
        <div className="flex items-center space-x-2 self-start sm:self-auto">
          {/* Refresh button */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              loadData();
            }}
            title="Refresh order records"
            className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-brand-dark" : ""}`} />
          </button>

          {/* Download Orders Data dropdown button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                setDownloadDropdownOpen(!downloadDropdownOpen);
              }}
              className="px-4 py-2.5 rounded-2xl bg-[#31145b] hover:bg-[#250d47] text-white font-bold text-xs shadow-xs transition active:scale-95 flex items-center space-x-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download Orders Data</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-70" />
            </button>

            {downloadDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-52 bg-white rounded-2xl shadow-xl border border-slate-100 p-1.5 z-40 animate-in fade-in slide-in-from-top-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={handleExportAllExcel}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 text-slate-800 transition flex items-center space-x-2 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-emerald-600" />
                  <span>Export to Excel (.xlsx)</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportAllCSV}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 text-slate-800 transition flex items-center space-x-2 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-indigo-600" />
                  <span>Export to CSV (.csv)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Real-Data Dismissible Notices Strip (Requirement 6) ── */}
      <OrderNoticesStrip
        counts={noticeCounts}
        onFilterTab={(tab) => {
          triggerHaptic("selection");
          setSelectedTab(tab);
        }}
      />

      {/* ── Seller Hub Order Status Tabs (Requirement 1) ── */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-2xs p-2 overflow-x-auto scrollbar-none">
        <div className="flex items-center space-x-1.5 min-w-max">
          {SELLER_HUB_TABS.map((tab) => {
            const isActive = selectedTab === tab.key;
            const count = tabCounts[tab.key] || 0;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  triggerHaptic("selection");
                  setSelectedTab(tab.key);
                }}
                className={`relative px-4 py-2.5 rounded-2xl text-xs font-black transition cursor-pointer flex items-center space-x-2 ${
                  isActive
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isActive
                      ? "bg-white/20 text-white"
                      : count > 0
                      ? "bg-slate-200 text-slate-700 font-black"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Search & Filters Bar (Requirement 2) ── */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search Box */}
          <div className="md:col-span-5 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search order code, customer, phone, business, or SKU..."
              className="w-full pl-9 pr-9 py-2.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-light transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Date Range Dropdown */}
          <div className="md:col-span-3">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <select
                value={dateRangeFilter}
                onChange={(e) => {
                  triggerHaptic("selection");
                  setDateRangeFilter(e.target.value as any);
                }}
                className="w-full pl-8 pr-7 py-2.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-light cursor-pointer"
              >
                <option value="all">Order Date: All Time</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="7_days">Last 7 Days</option>
                <option value="30_days">Last 30 Days</option>
                <option value="this_month">This Month</option>
                <option value="custom">Custom Date Range...</option>
              </select>
            </div>
          </div>

          {/* Source Dropdown */}
          <div className="md:col-span-2">
            <select
              value={sourceFilter}
              onChange={(e) => {
                triggerHaptic("selection");
                setSourceFilter(e.target.value as any);
              }}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-light cursor-pointer"
            >
              <option value="all">Source: All</option>
              <option value="website">Website Storefront</option>
              <option value="whatsapp">WhatsApp Direct</option>
            </select>
          </div>

          {/* Payment Status Dropdown */}
          <div className="md:col-span-2">
            <select
              value={paymentFilter}
              onChange={(e) => {
                triggerHaptic("selection");
                setPaymentFilter(e.target.value as any);
              }}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-light cursor-pointer"
            >
              <option value="all">Payment: All</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="cod">COD / Unpaid</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
        </div>

        {/* Custom Date Pickers (if custom selected) */}
        {dateRangeFilter === "custom" && (
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs">
            <span className="font-bold text-slate-500">From:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white"
            />
            <span className="font-bold text-slate-500">To:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white"
            />
          </div>
        )}

        {/* Active Filters Clear Strip */}
        {hasActiveFilters && (
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">
              Showing <strong>{filteredOrders.length}</strong> matching orders
            </span>
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-brand-dark font-bold hover:underline cursor-pointer flex items-center space-x-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear all filters</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Bulk Actions Floating / Top Bar (Requirement 5) ── */}
      {selectedOrderIds.size > 0 && (
        <div className="bg-slate-900 text-white rounded-3xl p-3.5 sm:p-4 shadow-xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center space-x-3">
            <span className="w-7 h-7 rounded-full bg-brand-light text-slate-900 font-black text-xs flex items-center justify-center">
              {selectedOrderIds.size}
            </span>
            <span className="font-black text-xs sm:text-sm">
              {selectedOrderIds.size} orders selected
            </span>
            <button
              type="button"
              onClick={() => setSelectedOrderIds(new Set())}
              className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
            >
              Deselect All
            </button>
          </div>

          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            {/* Mark Confirmed */}
            <button
              type="button"
              disabled={bulkActionInProgress}
              onClick={() => handleBulkStatusTransition("confirmed")}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition active:scale-95 disabled:opacity-40 cursor-pointer flex items-center space-x-1.5 shadow-2xs"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Mark Confirmed</span>
            </button>

            {/* Mark Shipped */}
            <button
              type="button"
              disabled={bulkActionInProgress}
              onClick={() => handleBulkStatusTransition("shipped")}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition active:scale-95 disabled:opacity-40 cursor-pointer flex items-center space-x-1.5 shadow-2xs"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Mark Shipped</span>
            </button>

            {/* Export Selected to Excel */}
            <button
              type="button"
              onClick={handleExportSelectedExcel}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition active:scale-95 cursor-pointer flex items-center space-x-1.5 shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export (.xlsx)</span>
            </button>

            {/* Export Selected to CSV */}
            <button
              type="button"
              onClick={handleExportSelectedCSV}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition active:scale-95 cursor-pointer flex items-center space-x-1.5 shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export (.csv)</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Error Banner ── */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={loadData}
            className="px-3 py-1 rounded-lg bg-rose-600 text-white font-bold cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Order Table (Desktop) & Cards (Mobile) (Requirement 3) ── */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-2xs overflow-hidden">
        {loading && orders.length === 0 ? (
          <div className="p-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-7 h-7 animate-spin text-brand-dark" />
            <span className="font-bold text-slate-700">Loading Seller Hub Orders...</span>
            <span className="text-[11px] text-slate-400">Fetching live order records from Supabase database</span>
          </div>
        ) : filteredOrders.length > 0 ? (
          <>
            {/* Desktop Table View (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 text-[10px] uppercase font-bold bg-slate-50/70">
                    <th className="py-3 px-4 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={handleToggleSelectAll}
                        className="w-4 h-4 rounded text-brand-dark focus:ring-brand-light cursor-pointer"
                        title="Select all orders on page"
                      />
                    </th>
                    <th className="py-3 px-3">Order Code</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Customer</th>
                    <th className="py-3 px-3">Items</th>
                    <th className="py-3 px-3">Total Amount</th>
                    <th className="py-3 px-3">Source</th>
                    <th className="py-3 px-3">Payment</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((ord) => {
                    const isSelected = selectedOrderIds.has(ord.id);
                    const statusConfig = ORDER_STATUS_BADGES[ord.status] || {
                      label: ord.status,
                      bg: "bg-slate-100",
                      text: "text-slate-700",
                      border: "border-slate-200",
                      dot: "bg-slate-400",
                    };
                    const firstItem = ord.items?.[0];
                    const itemsTotalQty = (ord.items || []).reduce((acc, i) => acc + (i.quantity || 0), 0);

                    return (
                      <tr
                        key={ord.id}
                        onClick={() => {
                          triggerHaptic("selection");
                          setSelectedOrder(ord);
                        }}
                        className={`transition cursor-pointer group ${
                          isSelected ? "bg-sky-50/50 hover:bg-sky-50/70" : "hover:bg-slate-50/70"
                        }`}
                      >
                        {/* Checkbox */}
                        <td
                          className="py-3.5 px-4 text-center"
                          onClick={(e) => handleToggleOrderSelect(ord.id, e)}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="w-4 h-4 rounded text-brand-dark focus:ring-brand-light cursor-pointer"
                          />
                        </td>

                        {/* Order Code */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-mono font-black text-slate-900 group-hover:text-brand-dark transition-colors">
                              #{ord.id}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleCopyOrderId(ord.id, e)}
                              className="p-1 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition"
                              title="Copy Order ID"
                            >
                              {copiedOrderId === ord.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Date */}
                        <td className="py-3.5 px-3 text-slate-500 whitespace-nowrap">
                          <div>
                            <span className="font-semibold text-slate-700">
                              {new Date(ord.created_at).toLocaleDateString("en-IN", {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                            <span className="text-[10px] text-slate-400 block font-mono">
                              {new Date(ord.created_at).toLocaleTimeString("en-IN", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </td>

                        {/* Customer Info (Name + Business + Phone) */}
                        <td className="py-3.5 px-3">
                          <div className="min-w-0 max-w-50">
                            <p className="font-bold text-slate-900 truncate">
                              {ord.customer?.name || "Customer"}
                            </p>
                            {ord.customer?.business_name && (
                              <p className="text-[11px] font-semibold text-slate-600 truncate">
                                {ord.customer.business_name}
                              </p>
                            )}
                            <p className="text-[10px] font-mono text-slate-400">
                              +91 {ord.customer?.phone || "—"}
                            </p>
                          </div>
                        </td>

                        {/* Items Count + First item preview */}
                        <td className="py-3.5 px-3">
                          <div>
                            <span className="font-black text-slate-800">
                              {itemsTotalQty} pcs
                            </span>
                            <span className="text-[11px] text-slate-400 block truncate max-w-35">
                              {firstItem?.name || "Merchandise"}
                            </span>
                          </div>
                        </td>

                        {/* Total Amount */}
                        <td className="py-3.5 px-3">
                          <div>
                            <span className="font-black text-slate-900 text-sm">
                              ₹{ord.total.toLocaleString("en-IN")}
                            </span>
                            {ord.savings !== undefined && ord.savings > 0 && (
                              <span className="text-[10px] text-emerald-600 font-bold block">
                                Save ₹{ord.savings}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Source Badge */}
                        <td className="py-3.5 px-3">
                          <span
                            className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              ord.source === "whatsapp"
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : "bg-sky-50 text-sky-800 border border-sky-200"
                            }`}
                          >
                            {ord.source === "whatsapp" ? (
                              <MessageCircle className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Globe className="w-3 h-3 text-sky-600" />
                            )}
                            <span className="capitalize">{ord.source || "Website"}</span>
                          </span>
                        </td>

                        {/* Payment Status Badge */}
                        <td className="py-3.5 px-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize ${
                              ord.payment_status === "paid"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : ord.payment_status === "cod"
                                ? "bg-blue-50 text-blue-800 border-blue-200"
                                : "bg-amber-50 text-amber-800 border-amber-200"
                            }`}
                          >
                            {ord.payment_status || "Pending"}
                          </span>
                        </td>

                        {/* Order Status Badge */}
                        <td className="py-3.5 px-3">
                          <span
                            className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                            <span>{statusConfig.label}</span>
                          </span>
                        </td>

                        {/* Action Button */}
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerHaptic("selection");
                              setSelectedOrder(ord);
                            }}
                            className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-700 font-bold text-xs transition cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Manage</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Layout (< 768px) */}
            <div className="md:hidden divide-y divide-slate-100 p-3 space-y-3">
              {filteredOrders.map((ord) => {
                const isSelected = selectedOrderIds.has(ord.id);
                const statusConfig = ORDER_STATUS_BADGES[ord.status] || {
                  label: ord.status,
                  bg: "bg-slate-100",
                  text: "text-slate-700",
                  border: "border-slate-200",
                  dot: "bg-slate-400",
                };
                const itemsTotalQty = (ord.items || []).reduce((acc, i) => acc + (i.quantity || 0), 0);

                return (
                  <div
                    key={ord.id}
                    onClick={() => {
                      triggerHaptic("selection");
                      setSelectedOrder(ord);
                    }}
                    className={`p-4 rounded-3xl border transition cursor-pointer space-y-3 ${
                      isSelected
                        ? "bg-sky-50/50 border-sky-200 shadow-xs"
                        : "bg-white border-slate-100 hover:border-slate-200 shadow-2xs"
                    }`}
                  >
                    {/* Top Row: Checkbox, Order Code, and Status Pill */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onClick={(e) => handleToggleOrderSelect(ord.id, e)}
                          onChange={() => {}}
                          className="w-4 h-4 rounded text-brand-dark focus:ring-brand-light cursor-pointer"
                        />
                        <span className="font-mono font-black text-sm text-slate-900">
                          #{ord.id}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleCopyOrderId(ord.id, e)}
                          className="p-1 rounded text-slate-400"
                        >
                          {copiedOrderId === ord.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      <span
                        className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                        <span>{statusConfig.label}</span>
                      </span>
                    </div>

                    {/* Customer & Items Details */}
                    <div className="text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{ord.customer?.name}</span>
                        <span className="font-black text-slate-900 text-sm">
                          ₹{ord.total.toLocaleString("en-IN")}
                        </span>
                      </div>
                      {ord.customer?.business_name && (
                        <p className="font-semibold text-slate-600">{ord.customer.business_name}</p>
                      )}
                      <p className="text-slate-400 font-mono text-[11px]">+91 {ord.customer?.phone}</p>
                    </div>

                    {/* Bottom Metadata & Action Row */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                        <span>{itemsTotalQty} pcs</span>
                        <span>&bull;</span>
                        <span className="capitalize">{ord.source || "Website"}</span>
                        <span>&bull;</span>
                        <span className="capitalize">{ord.payment_status || "Pending"}</span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerHaptic("selection");
                          setSelectedOrder(ord);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-bold text-xs"
                      >
                        Manage
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="p-16 text-center text-xs text-slate-400 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-slate-700 text-sm">No orders found</p>
              <p className="text-slate-400 mt-0.5">
                No consignments match the selected tab or filter criteria.
              </p>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition cursor-pointer"
              >
                Clear All Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Order Detail Modal ── */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdated={() => {
            loadData();
          }}
        />
      )}
    </div>
  );
}
