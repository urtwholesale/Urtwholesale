import { useState, useMemo, useEffect, useCallback } from "react";
import type {
  Order,
      Product,
  Profile,
} from "@urbanrat/shared";
import {
  ORDER_STATUS_BADGES,
  sanitizeSpreadsheetCell,
} from "@urbanrat/shared";
import {
  fetchDashboardOrders,
  fetchDashboardNewBuyers,
  fetchAdminProducts,
  adminMarkPartyBadDebt,
  adminUpdateOrderPaymentStatus,
} from "../../lib/adminService";
import { OrderDetailModal } from "../orders/OrderDetailModal";
import { triggerHaptic } from "../../utils/haptics";
import {
  X,
  Search,
  Download,
  Copy,
  Check,
  Phone,
  MessageCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Package,
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Users,
  ShieldAlert,
  Loader2,
  RotateCcw,
  Eye,
    ArrowUpDown,
  Building2,
  MapPin,
  FileSpreadsheet,
} from "lucide-react";

export type DashboardDrilldownType =
  | "revenue"
  | "orders"
  | "avg_order"
  | "pending"
  | "low_stock"
  | "new_buyers"
  | "daily_sale"
  | "status"
  | "product_buyers";

export interface DashboardDrilldownConfig {
  type: DashboardDrilldownType;
  title?: string;
  date?: string; // for daily_sale: YYYY-MM-DD
  status?: string; // for status
  productId?: string; // for product_buyers
  productName?: string; // for product_buyers
}

export interface PartyAggregate {
  key: string;
  name: string;
  businessName: string;
  phone: string;
  cleanPhone: string;
  city: string;
  state: string;
  address: string;
  gstin: string;
  totalOrders: number;
  totalRevenue: number; // excluding cancelled/refunded
  totalBilled: number; // all orders
  paidAmount: number;
  pendingDueAmount: number;
  badDebtAmount: number;
  isPartyBadDebt: boolean;
  partyBadDebtReason?: string;
  firstOrderDate: string;
  lastOrderDate: string;
  orders: Order[];
  itemsCount: number;
  productQuantityBought?: number; // for product_buyers drilldown
  productRevenueBought?: number; // for product_buyers drilldown
  statusCounts: Record<string, number>;
}

interface DashboardPartyDetailModalProps {
  config: DashboardDrilldownConfig;
  fromDate: string;
  toDate: string;
  onClose: () => void;
  onSelectOrder?: (orderId: string) => void;
  onNavigateTab?: (tab: any) => void;
}

export function DashboardPartyDetailModal({
  config,
  fromDate,
  toDate,
  onClose,
  onSelectOrder,
  onNavigateTab,
}: DashboardPartyDetailModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Raw data from Supabase
  const [orders, setOrders] = useState<Order[]>([]);
  const [newBuyers, setNewBuyers] = useState<Profile[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "due" | "paid" | "bad_debt" | "pending">("all");
  const [sortBy, setSortBy] = useState<"revenue" | "orders" | "aov" | "due" | "name">("revenue");

  // Expanded Party Accordions (party key -> boolean)
  const [expandedParties, setExpandedParties] = useState<Record<string, boolean>>({});

  // Single order inspection modal (nested)
  const [inspectingOrder, setInspectingOrder] = useState<Order | null>(null);

  // Action status feedback
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [badDebtInProgress, setBadDebtInProgress] = useState<string | null>(null);

  // ── Load Drilldown Data ──
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (config.type === "low_stock") {
        const prods = await fetchAdminProducts({ lowStock: true });
        setLowStockProducts(prods);
      } else if (config.type === "new_buyers") {
        const [buyers, ords] = await Promise.all([
          fetchDashboardNewBuyers(fromDate, toDate),
          fetchDashboardOrders(fromDate, toDate),
        ]);
        setNewBuyers(buyers);
        setOrders(ords);
      } else {
        const ords = await fetchDashboardOrders(fromDate, toDate);
        setOrders(ords);
      }
    } catch (err: any) {
      console.error("Failed to load dashboard drilldown data:", err);
      setError(err?.message || "Failed to load drilldown data.");
    } finally {
      setLoading(false);
    }
  }, [config.type, fromDate, toDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle ESC key to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !inspectingOrder) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, inspectingOrder]);

  // ── Compute Parties from Orders ──
  const partyAggregates = useMemo<PartyAggregate[]>(() => {
    if (config.type === "low_stock") return [];

    // Filter relevant orders depending on drilldown type
    let targetOrders = orders;

    if (config.type === "pending") {
      targetOrders = orders.filter((o) => o.status === "pending");
    } else if (config.type === "daily_sale" && config.date) {
      targetOrders = orders.filter((o) => o.created_at.startsWith(config.date!));
    } else if (config.type === "status" && config.status) {
      targetOrders = orders.filter((o) => o.status === config.status);
    } else if (config.type === "product_buyers" && (config.productId || config.productName)) {
      targetOrders = orders.filter((o) =>
        (o.items || []).some(
          (item) =>
            (config.productId && item.product_id === config.productId) ||
            (config.productName && item.name?.toLowerCase() === config.productName.toLowerCase())
        )
      );
    }

    const partyMap = new Map<string, PartyAggregate>();

    for (const order of targetOrders) {
      const rawPhone = order.customer?.phone || "";
      const cleanPhone = rawPhone.replace(/\D/g, "").slice(-10);
      const partyName = order.customer?.name?.trim() || "Wholesale Party";
      const businessName = order.customer?.business_name?.trim() || "";
      const partyKey = cleanPhone || order.user_id || partyName.toLowerCase();

      const existing = partyMap.get(partyKey);

      const orderTotal = Number(order.total || 0);
      const isCancelled = order.status === "cancelled" || order.status === "refunded";
      const isPaid = order.payment_status === "paid";
      const isBadDebt = order.payment_status === "bad_debt" || Boolean(order.is_party_bad_debt);

      const orderUnits = (order.items || []).reduce((acc, i) => acc + (Number(i.quantity) || 0), 0);

      // Product-specific units and revenue if product_buyers drilldown
      let prodQty = 0;
      let prodRev = 0;
      if (config.type === "product_buyers") {
        for (const it of order.items || []) {
          if (
            (config.productId && it.product_id === config.productId) ||
            (config.productName && it.name?.toLowerCase() === config.productName.toLowerCase())
          ) {
            prodQty += Number(it.quantity) || 0;
            prodRev += (Number(it.price) || 0) * (Number(it.quantity) || 0);
          }
        }
      }

      if (existing) {
        existing.orders.push(order);
        existing.totalOrders += 1;
        existing.totalBilled += orderTotal;
        if (!isCancelled) {
          existing.totalRevenue += orderTotal;
          if (isPaid) {
            existing.paidAmount += orderTotal;
          } else {
            existing.pendingDueAmount += orderTotal;
          }
        }
        if (isBadDebt) {
          existing.isPartyBadDebt = true;
          existing.badDebtAmount += orderTotal;
          if (order.party_bad_debt_reason && !existing.partyBadDebtReason) {
            existing.partyBadDebtReason = order.party_bad_debt_reason;
          }
        }
        existing.itemsCount += orderUnits;
        if (prodQty > 0) {
          existing.productQuantityBought = (existing.productQuantityBought || 0) + prodQty;
          existing.productRevenueBought = (existing.productRevenueBought || 0) + prodRev;
        }

        existing.statusCounts[order.status] = (existing.statusCounts[order.status] || 0) + 1;

        if (order.created_at < existing.firstOrderDate) existing.firstOrderDate = order.created_at;
        if (order.created_at > existing.lastOrderDate) existing.lastOrderDate = order.created_at;
      } else {
        partyMap.set(partyKey, {
          key: partyKey,
          name: partyName,
          businessName: businessName,
          phone: rawPhone,
          cleanPhone: cleanPhone,
          city: order.customer?.address || "",
          state: "",
          address: order.customer?.address || "",
          gstin: order.customer?.gstin || "",
          totalOrders: 1,
          totalBilled: orderTotal,
          totalRevenue: isCancelled ? 0 : orderTotal,
          paidAmount: !isCancelled && isPaid ? orderTotal : 0,
          pendingDueAmount: !isCancelled && !isPaid ? orderTotal : 0,
          badDebtAmount: isBadDebt ? orderTotal : 0,
          isPartyBadDebt: isBadDebt,
          partyBadDebtReason: order.party_bad_debt_reason || undefined,
          firstOrderDate: order.created_at,
          lastOrderDate: order.created_at,
          orders: [order],
          itemsCount: orderUnits,
          productQuantityBought: prodQty > 0 ? prodQty : undefined,
          productRevenueBought: prodRev > 0 ? prodRev : undefined,
          statusCounts: { [order.status]: 1 },
        });
      }
    }

    return Array.from(partyMap.values());
  }, [orders, config]);

  // ── Filtered & Sorted Parties ──
  const filteredParties = useMemo(() => {
    let result = partyAggregates;

    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.businessName.toLowerCase().includes(q) ||
          p.cleanPhone.includes(q) ||
          p.phone.toLowerCase().includes(q) ||
          p.city.toLowerCase().includes(q) ||
          p.gstin.toLowerCase().includes(q) ||
          p.orders.some((o) => o.id.toLowerCase().includes(q))
      );
    }

    // Tab filter
    if (filterTab === "due") {
      result = result.filter((p) => p.pendingDueAmount > 0);
    } else if (filterTab === "paid") {
      result = result.filter((p) => p.paidAmount > 0 && p.pendingDueAmount === 0);
    } else if (filterTab === "bad_debt") {
      result = result.filter((p) => p.isPartyBadDebt);
    } else if (filterTab === "pending") {
      result = result.filter((p) => (p.statusCounts["pending"] || 0) > 0);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === "revenue") {
        if (config.type === "product_buyers") {
          return (b.productRevenueBought || 0) - (a.productRevenueBought || 0);
        }
        return b.totalRevenue - a.totalRevenue;
      }
      if (sortBy === "orders") {
        if (config.type === "product_buyers") {
          return (b.productQuantityBought || 0) - (a.productQuantityBought || 0);
        }
        return b.totalOrders - a.totalOrders;
      }
      if (sortBy === "aov") {
        const aovA = a.totalOrders > 0 ? a.totalRevenue / a.totalOrders : 0;
        const aovB = b.totalOrders > 0 ? b.totalRevenue / b.totalOrders : 0;
        return aovB - aovA;
      }
      if (sortBy === "due") {
        return b.pendingDueAmount - a.pendingDueAmount;
      }
      if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      }
      return 0;
    });

    return result;
  }, [partyAggregates, searchTerm, filterTab, sortBy, config.type]);

  // ── Global Aggregated Metrics for the current drilldown ──
  const summaryMetrics = useMemo(() => {
    const totalParties = partyAggregates.length;
    const totalRevenue = partyAggregates.reduce((acc, p) => acc + p.totalRevenue, 0);
    const totalPaid = partyAggregates.reduce((acc, p) => acc + p.paidAmount, 0);
    const totalDue = partyAggregates.reduce((acc, p) => acc + p.pendingDueAmount, 0);
    const totalOrders = partyAggregates.reduce((acc, p) => acc + p.totalOrders, 0);
    const badDebtParties = partyAggregates.filter((p) => p.isPartyBadDebt).length;
    const pendingFulfillOrders = partyAggregates.reduce(
      (acc, p) => acc + (p.statusCounts["pending"] || 0),
      0
    );

    return {
      totalParties,
      totalRevenue,
      totalPaid,
      totalDue,
      totalOrders,
      badDebtParties,
      pendingFulfillOrders,
      overallAov: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
    };
  }, [partyAggregates]);

  // ── Actions ──
  function toggleExpandParty(key: string) {
    setExpandedParties((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  function handleCopyPhone(phone: string, key: string) {
    navigator.clipboard.writeText(phone);
    setCopiedKey(key);
    triggerHaptic("light");
    setTimeout(() => setCopiedKey(null), 2000);
  }

  function handleOpenWhatsApp(phone: string, name: string, dueAmount: number) {
    const clean = phone.replace(/\D/g, "");
    if (!clean) return;
    const waPhone = clean.length === 10 ? `91${clean}` : clean;
    const text = dueAmount > 0
      ? `Hello ${name}, greetings from Urbanrat Wholesale! We are reviewing current consignments. Your pending balance is ₹${dueAmount.toLocaleString("en-IN")}. Please let us know if you need assistance with payment or dispatch tracking.`
      : `Hello ${name}, greetings from Urbanrat Wholesale! Thank you for ordering wholesale with us. How can we assist your consignment requirements today?`;
    window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`, "_blank");
  }

  async function handleTogglePartyBadDebt(party: PartyAggregate) {
    const targetState = !party.isPartyBadDebt;
    const confirmMsg = targetState
      ? `Are you sure you want to mark ${party.name} (${party.phone}) as BAD DEBT? This will flag their account and highlight overdue collections across the admin hub.`
      : `Remove Bad Debt flag from ${party.name}?`;

    if (!window.confirm(confirmMsg)) return;

    setBadDebtInProgress(party.key);
    try {
      await adminMarkPartyBadDebt({
        phone: party.cleanPhone || party.phone,
        isBadDebt: targetState,
        reason: targetState ? "Overdue wholesale default via Dashboard Inspector" : undefined,
      });
      triggerHaptic("success");
      setActionSuccess(`${party.name} Bad Debt status updated!`);
      setTimeout(() => setActionSuccess(null), 3000);
      await loadData();
    } catch (err: any) {
      console.error("Failed to toggle party bad debt:", err);
      alert(err?.message || "Failed to update Bad Debt status.");
      triggerHaptic("heavy");
    } finally {
      setBadDebtInProgress(null);
    }
  }

  async function handleToggleOrderBadDebt(ord: Order) {
    const isCurrentlyBadDebt = ord.payment_status === "bad_debt";
    const targetStatus = isCurrentlyBadDebt ? "pending" : "bad_debt";
    const confirmMsg = isCurrentlyBadDebt
      ? `Clear Bad Debt flag for Order #${ord.id} and revert to Pending?`
      : `Mark ONLY Order #${ord.id} (₹${(ord.total || 0).toLocaleString("en-IN")}) as BAD DEBT?\n\nOther orders of this party will remain unaffected.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await adminUpdateOrderPaymentStatus(
        ord.id,
        targetStatus,
        isCurrentlyBadDebt
          ? "Bad debt cleared via Dashboard Party Inspector"
          : "Specific transaction marked as bad debt via Dashboard Party Inspector"
      );
      triggerHaptic("success");
      setActionSuccess(`Order #${ord.id} payment status updated to ${targetStatus.toUpperCase()}!`);
      setTimeout(() => setActionSuccess(null), 3000);
      await loadData();
    } catch (err: any) {
      console.error("Failed to update transaction bad debt:", err);
      alert(err?.message || "Failed to update order payment status.");
      triggerHaptic("heavy");
    }
  }

  // ── CSV Export ──
  function handleExportCSV() {
    const csvEsc = (val: unknown) => `"${String(sanitizeSpreadsheetCell(val) ?? "").replace(/"/g, '""')}"`;

    if (config.type === "low_stock") {
      const headers = ["Product Name", "SKU", "Current Stock", "Threshold", "Status"];
      const rows = lowStockProducts.map((p) => [
        csvEsc(p.name || ""),
        csvEsc(p.sku || ""),
        p.stock,
        p.low_stock_threshold || 5,
        p.stock === 0 ? "OUT OF STOCK" : "LOW STOCK",
      ]);
      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      downloadCSVFile(csv, `urt_low_stock_${fromDate}_to_${toDate}.csv`);
      return;
    }

    if (config.type === "new_buyers") {
      const headers = ["Full Name", "Business Name", "Phone", "Email", "GSTIN", "Registered Date"];
      const rows = newBuyers.map((b) => [
        csvEsc(b.full_name || ""),
        csvEsc(b.business_name || ""),
        csvEsc(b.phone || ""),
        csvEsc((b as any).email || ""),
        csvEsc(b.gstin || ""),
        b.created_at,
      ]);
      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      downloadCSVFile(csv, `urt_new_buyers_${fromDate}_to_${toDate}.csv`);
      return;
    }

    const headers = [
      "Party Name",
      "Business Name",
      "Phone",
      "City/Address",
      "GSTIN",
      "Total Orders",
      "Total Revenue",
      "Paid Amount",
      "Pending Due",
      "Is Bad Debt",
      "Bad Debt Reason",
      "First Order Date",
      "Last Order Date",
    ];

    const rows = filteredParties.map((p) => [
      csvEsc(p.name || ""),
      csvEsc(p.businessName || ""),
      csvEsc(p.phone || ""),
      csvEsc(p.city || ""),
      csvEsc(p.gstin || ""),
      p.totalOrders,
      p.totalRevenue,
      p.paidAmount,
      p.pendingDueAmount,
      p.isPartyBadDebt ? "YES" : "NO",
      csvEsc(p.partyBadDebtReason || ""),
      p.firstOrderDate,
      p.lastOrderDate,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    downloadCSVFile(csv, `urt_party_breakdown_${config.type}_${fromDate}_to_${toDate}.csv`);
  }

  function downloadCSVFile(csvContent: string, filename: string) {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerHaptic("success");
  }

  // ── Modal Title & Icon Helper ──
  const headerMeta = useMemo(() => {
    switch (config.type) {
      case "revenue":
        return {
          title: "Party-Wise Revenue & Collections Breakdown",
          subtitle: "Wholesale Party Ledgers • Paid Collections & Pending Dues",
          icon: DollarSign,
          color: "text-emerald-600 bg-emerald-50 border-emerald-200",
        };
      case "orders":
        return {
          title: "Party-Wise Wholesale Orders Breakdown",
          subtitle: "Consignment Volume & Fulfillments by Wholesale Party",
          icon: ShoppingBag,
          color: "text-primary bg-primary/10 border-primary/20",
        };
      case "avg_order":
        return {
          title: "Party-Wise Average Order Value & Purchasing Capacity",
          subtitle: "Buyer Ticket Sizes • Wholesale Tier Segmentation",
          icon: TrendingUp,
          color: "text-purple-600 bg-purple-50 border-purple-200",
        };
      case "pending":
        return {
          title: "Party-Wise Pending Dispatch & Action Center",
          subtitle: "Parties Awaiting Order Processing & Immediate Dispatch",
          icon: Clock,
          color: "text-amber-600 bg-amber-50 border-amber-200",
        };
      case "low_stock":
        return {
          title: "Low Stock Inventory & Restock Alerts",
          subtitle: "Active Catalog Products Below Reorder Threshold",
          icon: AlertTriangle,
          color: "text-rose-600 bg-rose-50 border-rose-200",
        };
      case "new_buyers":
        return {
          title: "Party-Wise New Registered Wholesale Buyers",
          subtitle: "Newly Onboarded Retailers & First Order Conversion",
          icon: Users,
          color: "text-sky-600 bg-sky-50 border-sky-200",
        };
      case "daily_sale":
        return {
          title: `Party-Wise Sales for ${new Date(config.date || "").toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}`,
          subtitle: "All Wholesale Consignments Placed on this Date",
          icon: FileSpreadsheet,
          color: "text-indigo-600 bg-indigo-50 border-indigo-200",
        };
      case "status":
        return {
          title: `Party-Wise Orders: ${(config.status || "").toUpperCase()}`,
          subtitle: `All Consignments Filtered by Status: ${config.status}`,
          icon: Package,
          color: "text-blue-600 bg-blue-50 border-blue-200",
        };
      case "product_buyers":
        return {
          title: `Party-Wise Buyers for: ${config.productName || "Product"}`,
          subtitle: "Parties Who Ordered this SKU & Quantities Consigned",
          icon: Package,
          color: "text-emerald-600 bg-emerald-50 border-emerald-200",
        };
      default:
        return {
          title: "Detailed Party-Wise Breakdown",
          subtitle: "Wholesale Executive Analytics Drilldown",
          icon: Package,
          color: "text-slate-600 bg-slate-50 border-slate-200",
        };
    }
  }, [config]);

  const HeaderIcon = headerMeta.icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !inspectingOrder) onClose();
      }}
    >
      <div className="bg-white dark:bg-slate-900 w-full max-w-6xl max-h-[92vh] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* ── Top Header Bar ── */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-white dark:bg-slate-900 shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 ${headerMeta.color}`}>
              <HeaderIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 truncate">
                {headerMeta.title}
              </h2>
              <div className="flex items-center space-x-2 text-xs text-slate-500">
                <span>{headerMeta.subtitle}</span>
                <span>•</span>
                <span className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-semibold text-slate-700 dark:text-slate-300">
                  {fromDate} to {toDate}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200 transition cursor-pointer"
              title="Export this party breakdown report to CSV"
            >
              <Download className="w-3.5 h-3.5 text-primary" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-500 flex items-center justify-center transition cursor-pointer dark:bg-slate-800 dark:text-slate-400"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Action Success Alert ── */}
        {actionSuccess && (
          <div className="px-5 py-2.5 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-100 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center space-x-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* ── Error Banner ── */}
        {error && (
          <div className="px-5 py-2.5 bg-rose-50 border-b border-rose-100 text-rose-800 text-xs font-bold flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={loadData}
              className="px-2.5 py-1 rounded bg-rose-600 text-white font-bold hover:bg-rose-700 transition"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Top Metric Strip for this Drilldown ── */}
        {config.type !== "low_stock" && config.type !== "new_buyers" && (
          <div className="px-5 py-3 bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 shrink-0 text-xs">
            <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200/60 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Parties Active</span>
              <p className="text-sm font-black text-slate-900 dark:text-slate-100 mt-0.5">
                {summaryMetrics.totalParties}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200/60 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Total Revenue</span>
              <p className="text-sm font-black text-emerald-700 dark:text-emerald-400 mt-0.5">
                ₹{summaryMetrics.totalRevenue.toLocaleString("en-IN")}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200/60 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Paid / Collected</span>
              <p className="text-sm font-black text-emerald-600 mt-0.5">
                ₹{summaryMetrics.totalPaid.toLocaleString("en-IN")}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200/60 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Pending Due</span>
              <p className={`text-sm font-black mt-0.5 ${summaryMetrics.totalDue > 0 ? "text-amber-600" : "text-slate-700 dark:text-slate-300"}`}>
                ₹{summaryMetrics.totalDue.toLocaleString("en-IN")}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200/60 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Consignments</span>
              <p className="text-sm font-black text-slate-900 dark:text-slate-100 mt-0.5">
                {summaryMetrics.totalOrders}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200/60 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Bad Debt Parties</span>
              <p className={`text-sm font-black mt-0.5 ${summaryMetrics.badDebtParties > 0 ? "text-rose-600" : "text-slate-700 dark:text-slate-300"}`}>
                {summaryMetrics.badDebtParties}
              </p>
            </div>
          </div>
        )}

        {/* ── Search & Filter Controls ── */}
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-900 shrink-0">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={
                config.type === "low_stock"
                  ? "Search products by name or SKU..."
                  : config.type === "new_buyers"
                  ? "Search buyer by name, phone, business or city..."
                  : "Search party by name, phone, business, city, or order #..."
              }
              className="w-full pl-9 pr-8 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-primary/20 text-slate-800 dark:text-slate-200 placeholder-slate-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {config.type !== "low_stock" && config.type !== "new_buyers" && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Quick Tab Filters */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300">
                <button
                  type="button"
                  onClick={() => setFilterTab("all")}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    filterTab === "all" ? "bg-white dark:bg-slate-700 text-primary shadow-xs" : ""
                  }`}
                >
                  All ({partyAggregates.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab("due")}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    filterTab === "due" ? "bg-white dark:bg-slate-700 text-amber-600 shadow-xs" : ""
                  }`}
                >
                  Pending Due
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab("paid")}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    filterTab === "paid" ? "bg-white dark:bg-slate-700 text-emerald-600 shadow-xs" : ""
                  }`}
                >
                  Fully Paid
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab("bad_debt")}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    filterTab === "bad_debt" ? "bg-white dark:bg-slate-700 text-rose-600 shadow-xs" : ""
                  }`}
                >
                  Bad Debt
                </button>
              </div>

              {/* Sort Selector */}
              <div className="flex items-center space-x-1.5 text-xs text-slate-500">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer focus:ring-0"
                >
                  <option value="revenue">Highest Revenue</option>
                  <option value="orders">Most Orders</option>
                  <option value="aov">Highest AOV</option>
                  <option value="due">Highest Dues</option>
                  <option value="name">Name (A-Z)</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* ── Modal Main Scrollable Content ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-xs font-bold">Aggregating real-time party metrics from orders...</p>
            </div>
          ) : config.type === "low_stock" ? (
            /* ──────────────── Low Stock Inventory View ──────────────── */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{lowStockProducts.length} items flagged with stock at or below threshold</span>
                {onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateTab("products");
                    }}
                    className="text-primary font-bold hover:underline flex items-center space-x-1"
                  >
                    <span>Open Products Catalog</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>

              {lowStockProducts.length === 0 ? (
                <div className="py-16 text-center text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                  <p className="font-bold text-sm text-slate-700 dark:text-slate-300">All Stock Levels Healthy</p>
                  <p className="text-xs text-slate-400 mt-1">No products are currently below their reorder thresholds.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden">
                  {lowStockProducts.map((p) => (
                    <div key={p.id} className="p-3.5 sm:p-4 flex items-center justify-between gap-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition">
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 flex items-center justify-center border border-slate-200/60">
                          {p.images && p.images[0] ? (
                            <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100 truncate">
                            {p.name}
                          </h4>
                          <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5">
                            <span className="font-mono font-bold text-slate-600 dark:text-slate-300">SKU: {p.sku}</span>
                            <span>•</span>
                            <span>Price: ₹{p.price}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          p.stock === 0
                            ? "bg-rose-100 text-rose-700 border border-rose-200"
                            : "bg-amber-100 text-amber-700 border border-amber-200"
                        }`}>
                          {p.stock === 0 ? "Out of Stock" : `Low Stock: ${p.stock} left`}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-1">
                          Threshold: {p.low_stock_threshold || 5} pcs
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : config.type === "new_buyers" ? (
            /* ──────────────── New Buyers View ──────────────── */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{newBuyers.length} new buyer accounts registered in this timeframe</span>
              </div>

              {newBuyers.length === 0 ? (
                <div className="py-16 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-100">
                  <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="font-bold text-sm text-slate-700">No New Registrations</p>
                  <p className="text-xs text-slate-400 mt-1">No wholesale customer profiles signed up in this date range.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {newBuyers.map((buyer) => {
                    // Check if buyer has placed orders
                    const buyerPhone = (buyer.phone || "").replace(/\D/g, "").slice(-10);
                    const buyerOrders = orders.filter((o) => {
                      const op = (o.customer?.phone || "").replace(/\D/g, "").slice(-10);
                      return op && op === buyerPhone;
                    });
                    const totalSpend = buyerOrders.reduce((acc, o) => acc + Number(o.total || 0), 0);

                    return (
                      <div
                        key={buyer.id}
                        className="bg-white dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-2xs space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 font-black text-sm flex items-center justify-center shrink-0 border border-sky-100">
                              {(buyer.full_name || "B").slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100">
                                {buyer.full_name || "Wholesale Buyer"}
                              </h4>
                              {buyer.business_name && (
                                <p className="text-xs text-slate-500 font-medium flex items-center space-x-1 mt-0.5">
                                  <Building2 className="w-3 h-3 text-slate-400" />
                                  <span>{buyer.business_name}</span>
                                </p>
                              )}
                            </div>
                          </div>

                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            buyerOrders.length > 0
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : "bg-slate-100 text-slate-600"
                          }`}>
                            {buyerOrders.length > 0 ? `${buyerOrders.length} Orders Placed` : "No Orders Yet"}
                          </span>
                        </div>

                        <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-bold">Contact</span>
                            <p className="font-mono text-slate-700 dark:text-slate-300 font-semibold">{buyer.phone || "No phone"}</p>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-bold">GSTIN</span>
                            <p className="font-mono text-slate-700 dark:text-slate-300 font-semibold">{buyer.gstin || "Unregistered"}</p>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-bold">Registered</span>
                            <p className="text-slate-600 dark:text-slate-400">
                              {new Date(buyer.created_at).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                              })}
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-bold">Wholesale Spend</span>
                            <p className="font-black text-slate-900 dark:text-slate-100">
                              ₹{totalSpend.toLocaleString("en-IN")}
                            </p>
                          </div>
                        </div>

                        {buyer.phone && (
                          <div className="pt-2 flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={() => handleOpenWhatsApp(buyer.phone!, buyer.full_name || "Buyer", 0)}
                              className="flex-1 py-1.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center space-x-1.5 transition cursor-pointer"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>WhatsApp Onboarding</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyPhone(buyer.phone!, buyer.id)}
                              className="p-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                              title="Copy Phone"
                            >
                              {copiedKey === buyer.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* ──────────────── Party-Wise Breakdown List (Revenue, Orders, Daily Sales, Status, Product) ──────────────── */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Showing {filteredParties.length} wholesale parties matching filters</span>
                <span className="text-[11px] text-slate-400">
                  Click &ldquo;View Consignments&rdquo; on any party to inspect specific order items
                </span>
              </div>

              {filteredParties.length === 0 ? (
                <div className="py-16 text-center text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100">
                  <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="font-bold text-sm text-slate-700 dark:text-slate-300">No Parties Found</p>
                  <p className="text-xs text-slate-400 mt-1">No customer consignments match the selected search or filter criteria.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredParties.map((party) => {
                    const isExpanded = Boolean(expandedParties[party.key]);
                    const aov = party.totalOrders > 0 ? Math.round(party.totalRevenue / party.totalOrders) : 0;

                    return (
                      <div
                        key={party.key}
                        className={`bg-white dark:bg-slate-800/90 rounded-2xl border transition shadow-xs overflow-hidden ${
                          party.isPartyBadDebt
                            ? "border-rose-300 dark:border-rose-800 bg-rose-50/20"
                            : party.pendingDueAmount > 0
                            ? "border-amber-200 dark:border-amber-900/60"
                            : "border-slate-200/80 dark:border-slate-700"
                        }`}
                      >
                        {/* ── Party Card Header ── */}
                        <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                          {/* Party Identity */}
                          <div className="flex items-start space-x-3.5 min-w-0">
                            <div className={`w-11 h-11 rounded-2xl font-black text-sm flex items-center justify-center shrink-0 border shadow-2xs ${
                              party.isPartyBadDebt
                                ? "bg-rose-100 text-rose-700 border-rose-200"
                                : "bg-primary/10 text-primary border-primary/20"
                            }`}>
                              {party.name.slice(0, 2).toUpperCase()}
                            </div>

                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 tracking-tight truncate">
                                  {party.name}
                                </h3>

                                {party.isPartyBadDebt && (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300 flex items-center space-x-1">
                                    <ShieldAlert className="w-2.5 h-2.5" />
                                    <span>Bad Debt Account</span>
                                  </span>
                                )}

                                {party.pendingDueAmount > 0 && !party.isPartyBadDebt && (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
                                    ₹{party.pendingDueAmount.toLocaleString("en-IN")} Due
                                  </span>
                                )}

                                {party.paidAmount > 0 && party.pendingDueAmount === 0 && (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    All Paid
                                  </span>
                                )}
                              </div>

                              {party.businessName && (
                                <p className="text-xs text-slate-500 font-semibold flex items-center space-x-1.5 mt-0.5">
                                  <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span>{party.businessName}</span>
                                </p>
                              )}

                              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                                <div className="flex items-center space-x-1">
                                  <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                                    {party.phone || "No Phone"}
                                  </span>
                                  {party.phone && (
                                    <button
                                      type="button"
                                      onClick={() => handleCopyPhone(party.phone, party.key)}
                                      className="p-1 hover:text-primary transition"
                                      title="Copy phone"
                                    >
                                      {copiedKey === party.key ? (
                                        <Check className="w-3 h-3 text-emerald-600" />
                                      ) : (
                                        <Copy className="w-3 h-3 text-slate-400" />
                                      )}
                                    </button>
                                  )}
                                </div>

                                {party.city && (
                                  <div className="flex items-center space-x-1 text-slate-400 truncate max-w-50">
                                    <MapPin className="w-3 h-3 shrink-0" />
                                    <span className="truncate">{party.city}</span>
                                  </div>
                                )}

                                {party.gstin && (
                                  <span className="font-mono text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-700/60 px-1.5 py-0.5 rounded">
                                    GST: {party.gstin}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Party Financial Metrics Grid */}
                          <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-700/60">
                            {config.type === "product_buyers" ? (
                              <div className="text-right">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Product Qty</span>
                                <p className="text-sm font-black text-slate-900 dark:text-slate-100">
                                  {party.productQuantityBought || 0} pcs
                                </p>
                                <p className="text-[10px] font-bold text-emerald-600">
                                  ₹{(party.productRevenueBought || 0).toLocaleString("en-IN")}
                                </p>
                              </div>
                            ) : null}

                            <div className="text-right">
                              <span className="text-[10px] font-bold text-slate-400 uppercase">Revenue</span>
                              <p className="text-sm font-black text-slate-900 dark:text-slate-100">
                                ₹{party.totalRevenue.toLocaleString("en-IN")}
                              </p>
                              <p className="text-[10px] font-bold text-emerald-600">
                                ₹{party.paidAmount.toLocaleString("en-IN")} paid
                              </p>
                            </div>

                            <div className="text-right">
                              <span className="text-[10px] font-bold text-slate-400 uppercase">Orders</span>
                              <p className="text-sm font-black text-slate-900 dark:text-slate-100">
                                {party.totalOrders}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                AOV: ₹{aov.toLocaleString("en-IN")}
                              </p>
                            </div>

                            {/* Accordion Toggle Button */}
                            <button
                              type="button"
                              onClick={() => toggleExpandParty(party.key)}
                              className={`p-2 rounded-xl border transition cursor-pointer ${
                                isExpanded
                                  ? "bg-primary text-white border-primary"
                                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600"
                              }`}
                              title={isExpanded ? "Collapse orders" : "View party orders"}
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {/* ── Party Actions Strip ── */}
                        <div className="px-4 sm:px-5 py-2.5 bg-slate-50/70 dark:bg-slate-850 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center space-x-2">
                            {party.phone && (
                              <button
                                type="button"
                                onClick={() => handleOpenWhatsApp(party.phone, party.name, party.pendingDueAmount)}
                                className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold transition cursor-pointer dark:bg-emerald-950/40 dark:text-emerald-300"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>WhatsApp Ledger</span>
                              </button>
                            )}

                            <button
                              type="button"
                              disabled={badDebtInProgress === party.key}
                              onClick={() => handleTogglePartyBadDebt(party)}
                              className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg font-bold transition cursor-pointer disabled:opacity-50 ${
                                party.isPartyBadDebt
                                  ? "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                                  : "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200"
                              }`}
                            >
                              <ShieldAlert className="w-3 h-3" />
                              <span>{party.isPartyBadDebt ? "Clear Bad Debt Flag" : "Mark Party Bad Debt"}</span>
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleExpandParty(party.key)}
                            className="text-xs font-bold text-primary hover:underline flex items-center space-x-1 cursor-pointer"
                          >
                            <span>{isExpanded ? "Hide Consignments" : `View ${party.orders.length} Consignments`}</span>
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        </div>

                        {/* ── Expanded Order Consignments Table ── */}
                        {isExpanded && (
                          <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 space-y-3 animate-in fade-in duration-150">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                              Order Consignments for {party.name} ({party.orders.length})
                            </h4>

                            <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden text-xs">
                              {party.orders.map((ord) => {
                                const statusBadge: any = ORDER_STATUS_BADGES[ord.status] || {
                                  label: ord.status,
                                  bg: "bg-slate-100",
                                  text: "text-slate-700",
                                  border: "border-slate-200",
                                  dot: "bg-slate-400",
                                };

                                return (
                                  <div
                                    key={ord.id}
                                    className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-750 transition"
                                  >
                                    <div className="min-w-0 space-y-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-mono font-black text-slate-900 dark:text-slate-100 text-xs">
                                          #{ord.id}
                                        </span>

                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${statusBadge.bg} ${statusBadge.text} ${statusBadge.border}`}>
                                          {statusBadge.label}
                                        </span>

                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                          ord.payment_status === "paid"
                                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                            : ord.payment_status === "bad_debt"
                                            ? "bg-rose-100 text-rose-800 border border-rose-200"
                                            : "bg-amber-100 text-amber-800 border border-amber-200"
                                        }`}>
                                          {ord.payment_status === "paid" ? "PAID" : ord.payment_status === "bad_debt" ? "BAD DEBT" : "PENDING PAYMENT"}
                                        </span>
                                      </div>

                                      <p className="text-[11px] text-slate-400">
                                        Placed: {new Date(ord.created_at).toLocaleString("en-IN", {
                                          day: "numeric",
                                          month: "short",
                                          year: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </p>

                                      {/* Items snippet */}
                                      <div className="text-[11px] text-slate-600 dark:text-slate-300 font-medium truncate max-w-xl">
                                        {(ord.items || []).map((i) => `${i.quantity}× ${i.name}`).join(", ")}
                                      </div>
                                    </div>

                                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                                      <div className="text-right">
                                        <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100">
                                          ₹{Number(ord.total || 0).toLocaleString("en-IN")}
                                        </span>
                                        <p className="text-[10px] text-slate-400">
                                          {(ord.items || []).reduce((acc, i) => acc + (Number(i.quantity) || 0), 0)} items
                                        </p>
                                      </div>

                                      {/* Inspect Order in Modal */}
                                      <button
                                        type="button"
                                        onClick={() => setInspectingOrder(ord)}
                                        className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-primary hover:text-white text-slate-700 dark:bg-slate-700 dark:text-slate-200 font-bold transition cursor-pointer text-xs"
                                        title="Inspect full consignment details, change status or update payment"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                        <span>Inspect</span>
                                      </button>

                                      {ord.payment_status === "bad_debt" ? (
                                        <button
                                          type="button"
                                          onClick={() => handleToggleOrderBadDebt(ord)}
                                          className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 border border-slate-300 font-bold transition cursor-pointer text-xs"
                                          title="Clear Bad Debt for this specific transaction"
                                        >
                                          <RotateCcw className="w-3 h-3" />
                                          <span className="hidden sm:inline">Clear Bad Debt</span>
                                        </button>
                                      ) : ord.payment_status !== "paid" && (
                                        <button
                                          type="button"
                                          onClick={() => handleToggleOrderBadDebt(ord)}
                                          className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 font-bold transition cursor-pointer text-xs"
                                          title="Count only this specific transaction as Bad Debt"
                                        >
                                          <ShieldAlert className="w-3 h-3" />
                                          <span className="hidden sm:inline">Bad Debt</span>
                                        </button>
                                      )}
                                      {onSelectOrder && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            onSelectOrder(ord.id);
                                            onClose();
                                          }}
                                          className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary text-slate-600 dark:text-slate-300 hover:text-primary transition text-xs font-bold cursor-pointer"
                                          title="Open this consignment in Seller Hub Orders tab"
                                        >
                                          <ExternalLink className="w-3.5 h-3.5" />
                                          <span className="hidden sm:inline">Hub</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Modal Footer ── */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0 text-xs">
          <span className="text-slate-400 font-medium">
            Urbanrat Wholesale Executive Suite • Press ESC to close
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200 font-bold transition cursor-pointer"
          >
            Close Details
          </button>
        </div>
      </div>

      {/* ── Nested Order Detail Modal ── */}
      {inspectingOrder && (
        <OrderDetailModal
          order={inspectingOrder}
          onClose={() => setInspectingOrder(null)}
          onUpdated={async () => {
            await loadData();
            // Refresh the currently inspecting order from newly fetched orders
            const refreshed = orders.find((o) => o.id === inspectingOrder.id);
            if (refreshed) setInspectingOrder(refreshed);
          }}
        />
      )}
    </div>
  );
}
