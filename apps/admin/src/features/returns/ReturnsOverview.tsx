import { useState, useEffect } from "react";
import type {
  ReturnStats,
  ProductReturnPerformance,
  Category,
} from "@urbanrat/shared";
import {
  RETURN_REASON_LABELS,
} from "@urbanrat/shared";
import {
  fetchReturnStats,
  fetchProductReturnPerformance,
  fetchCategories,
  exportProductPerformanceToExcel,
} from "../../lib/adminService";
import { triggerHaptic } from "../../utils/haptics";
import {
  AlertTriangle,
  RotateCcw,
  IndianRupee,
  Clock,
  ShieldAlert,
  Download,
  Search,
  Package,
  Sparkles,
  ArrowUpRight,
  TrendingUp,
  X,
  CheckCircle2,
} from "lucide-react";

interface ReturnsOverviewProps {
  onSwitchToTracking: (filterQuery?: string) => void;
}

export function ReturnsOverview({ onSwitchToTracking }: ReturnsOverviewProps) {
  const [periodDays, setPeriodDays] = useState<number>(30);
  const [stats, setStats] = useState<ReturnStats | null>(null);
  const [products, setProducts] = useState<ProductReturnPerformance[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Table filters & sorting
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [performanceFilter, setPerformanceFilter] = useState<"all" | "high" | "low" | "zero">("all");
  const [sortBy, setSortBy] = useState<"rate" | "returned" | "delivered" | "name">("rate");

  // Selected product detail preview modal
  const [inspectProduct, setInspectProduct] = useState<ProductReturnPerformance | null>(null);
  const [assuranceModalOpen, setAssuranceModalOpen] = useState(false);

  useEffect(() => {
    loadAllData();
  }, [periodDays]);

  async function loadAllData() {
    try {
      const [statsData, perfData, catsData] = await Promise.all([
        fetchReturnStats(periodDays),
        fetchProductReturnPerformance(periodDays),
        fetchCategories(),
      ]);
      setStats(statsData);
      setProducts(perfData);
      setCategories(catsData);
    } catch (err) {
      console.error("Failed to load return stats:", err);
    }
  }

  // Filtered & sorted products
  const filteredProducts = products.filter((p) => {
    if (selectedCategory !== "all" && p.category_id !== selectedCategory) {
      return false;
    }
    if (performanceFilter === "high" && !p.is_high_return) {
      return false;
    }
    if (performanceFilter === "low" && (p.return_rate_percentage > 2.0 || p.returns_count === 0)) {
      return false;
    }
    if (performanceFilter === "zero" && p.returns_count > 0) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchName = p.product_name?.toLowerCase().includes(q);
      const matchSku = p.sku?.toLowerCase().includes(q);
      const matchCat = p.category_name?.toLowerCase().includes(q);
      return matchName || matchSku || matchCat;
    }
    return true;
  }).sort((a, b) => {
    if (sortBy === "rate") return b.return_rate_percentage - a.return_rate_percentage;
    if (sortBy === "returned") return b.quantity_returned - a.quantity_returned;
    if (sortBy === "delivered") return b.orders_delivered - a.orders_delivered;
    return a.product_name.localeCompare(b.product_name);
  });

  function handleExportPerformance() {
    triggerHaptic("selection");
    exportProductPerformanceToExcel(
      filteredProducts,
      `URT_Returns_Product_Performance_${periodDays}d.xlsx`
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Top Bar: Period Switcher & Live Meta ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs">
        <div>
          <h2 className="text-sm font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <span>Returns &amp; Quality Intelligence</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-light/30 text-brand-dark">
              Last {periodDays} Days
            </span>
          </h2>
          <p className="text-[11px] text-slate-500">
            Real-time RMA analytics, supplier damage claims, and product return rates
          </p>
        </div>

        {/* Date Filter Tabs */}
        <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-2xl">
          {[
            { label: "7 Days", value: 7 },
            { label: "30 Days", value: 30 },
            { label: "90 Days", value: 90 },
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                setPeriodDays(tab.value);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                periodDays === tab.value
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Promotional Seller Banner (Inspired by Meesho Screenshot) ── */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-amber-50 via-orange-50 to-amber-100/60 border border-amber-200/90 p-5 sm:p-6 shadow-xs">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-400/30 border border-amber-400/40 flex items-center justify-center text-amber-800 text-2xl shrink-0">
              📦
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight flex items-center space-x-2">
                <span>High returns ka tension? Save Return Shipping Fees with Return Assurance</span>
              </h3>
              <p className="text-xs text-slate-600 mt-0.5 max-w-xl">
                Get zero-deduction refunds on transit damage and dead-on-arrival consignments via our verified reverse courier partner network.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setAssuranceModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              Know More
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                alert("Our Wholesale Operations Manager will contact your registered phone within 2 business hours.");
              }}
              className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-amber-300 text-xs font-bold transition cursor-pointer"
            >
              Request Callback
            </button>
          </div>
        </div>
      </div>

      {/* ── 5 Key Metric Cards (from get_return_stats) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* 1. Total Returns */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Total Returns
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <RotateCcw className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900">
            {stats?.total_returns ?? 0}
          </div>
          <span className="text-[10px] font-semibold text-slate-500 block">
            Across {stats?.total_delivered_orders ?? 0} delivered orders
          </span>
        </div>

        {/* 2. Customer Return Rate % */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Return Rate
            </span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 flex items-baseline space-x-1">
            <span>{stats?.return_rate_percentage ?? "0.00"}%</span>
            <span className={`text-[10px] font-bold ${
              (stats?.return_rate_percentage || 0) > 5 ? "text-rose-600" : "text-emerald-600"
            }`}>
              {(stats?.return_rate_percentage || 0) > 5 ? "High" : "Healthy"}
            </span>
          </div>
          <span className="text-[10px] font-semibold text-slate-500 block">
            Target benchmark: &lt; 3.5%
          </span>
        </div>

        {/* 3. Total Refunds Value */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Refund Value
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <IndianRupee className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900">
            ₹{(stats?.total_refunds_value || 0).toLocaleString("en-IN")}
          </div>
          <span className="text-[10px] font-semibold text-slate-500 block">
            Processed to customer credits
          </span>
        </div>

        {/* 4. Pending Actions */}
        <div
          onClick={() => onSwitchToTracking("requested")}
          className="p-4 sm:p-5 rounded-3xl bg-amber-50/70 border border-amber-200 shadow-2xs space-y-2 cursor-pointer hover:bg-amber-100/70 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-800">
              Pending Actions
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-200/80 text-amber-800 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-950 flex items-center space-x-2">
            <span>{stats?.pending_actions_count ?? 0}</span>
            <ArrowUpRight className="w-4 h-4 text-amber-700" />
          </div>
          <span className="text-[10px] font-bold text-amber-800 block">
            Needs review / warehouse QC
          </span>
        </div>

        {/* 5. QC Fail Count */}
        <div className="p-4 sm:p-5 rounded-3xl bg-rose-50/70 border border-rose-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-800">
              QC Fail Count
            </span>
            <div className="w-7 h-7 rounded-lg bg-rose-200/80 text-rose-800 flex items-center justify-center">
              <ShieldAlert className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-rose-950">
            {stats?.qc_failed_count ?? 0}
          </div>
          <span className="text-[10px] font-bold text-rose-700 block">
            Eligible for courier/vendor claims
          </span>
        </div>
      </div>

      {/* ── Return Reason Breakdown & Dual Pricing Block ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Reason Breakdown Chart */}
        <div className="lg:col-span-2 p-5 rounded-3xl bg-white border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                Return Reasons Breakdown
              </h3>
              <p className="text-[11px] text-slate-500">
                Categorized buyer feedback for root-cause quality analysis
              </p>
            </div>
            <span className="text-xs font-mono font-black text-slate-900">
              {stats?.total_returns || 0} Total Requests
            </span>
          </div>

          {(!stats?.reason_breakdown || stats.reason_breakdown.length === 0) ? (
            <div className="py-10 text-center text-xs text-slate-400">
              No return reasons reported in this period.
            </div>
          ) : (
            <div className="space-y-3">
              {stats.reason_breakdown.map((r) => {
                const colors: Record<string, { bg: string; text: string; fill: string }> = {
                  damaged: { bg: "bg-rose-50", text: "text-rose-700", fill: "bg-rose-500" },
                  defective: { bg: "bg-amber-50", text: "text-amber-800", fill: "bg-amber-500" },
                  wrong_item: { bg: "bg-purple-50", text: "text-purple-700", fill: "bg-purple-500" },
                  short_quantity: { bg: "bg-blue-50", text: "text-blue-700", fill: "bg-blue-500" },
                  quality_issue: { bg: "bg-orange-50", text: "text-orange-700", fill: "bg-orange-500" },
                  other: { bg: "bg-slate-100", text: "text-slate-700", fill: "bg-slate-400" },
                };
                const color = colors[r.reason_code] ?? colors["other"]!;

                return (
                  <div key={r.reason_code} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-800">
                        {RETURN_REASON_LABELS[r.reason_code] || r.reason_code}
                      </span>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-slate-900">{r.count} units</span>
                        <span className="font-mono text-slate-400">({r.percentage}%)</span>
                      </div>
                    </div>
                    {/* Visual Progress Bar */}
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${color.fill} transition-all duration-500`}
                        style={{ width: `${Math.min(100, Math.max(4, r.percentage))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Col: Dual Pricing Quality Benchmark (Matches Screenshot) */}
        <div className="p-5 rounded-3xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Wholesale SLA Benchmark
            </span>
            <h4 className="text-sm font-black text-slate-900 leading-tight">
              Dual Pricing - Customer Return Rate
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Wholesale buyers enjoy discounted tier pricing with dedicated reverse courier assurance.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-white border border-slate-200">
            <div>
              <p className="text-[10px] font-bold text-slate-500">Defective Returns</p>
              <p className="text-base font-black text-emerald-600 mt-0.5">
                {stats?.reason_breakdown?.find((r) => r.reason_code === "defective")?.percentage ?? "0.00"}%
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500">Transit Damage</p>
              <p className="text-base font-black text-amber-600 mt-0.5">
                {stats?.reason_breakdown?.find((r) => r.reason_code === "damaged")?.percentage ?? "0.00"}%
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2">
            <div className="flex items-center space-x-2 text-xs font-black text-amber-900">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>RTO Approved Claims</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Use transparent barcoded tamper-evident packaging to qualify for up to 80% instant claim reimbursement.
            </p>
          </div>
        </div>
      </div>

      {/* ── Product Performance Table (Matching Screenshot) ── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden space-y-4 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 tracking-tight">
              Product Performance
            </h3>
            <p className="text-[11px] text-slate-500">
              Delivered units, return ratios, and high-return hazard indicators
            </p>
          </div>

          <button
            type="button"
            onClick={handleExportPerformance}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export XLSX</span>
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search product name or SKU..."
              className="w-full pl-8.5 pr-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-brand-dark"
            />
          </div>

          {/* Filter by Category */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-brand-dark cursor-pointer"
            >
              <option value="all">Filter by: All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filter by Performance */}
          <div>
            <select
              value={performanceFilter}
              onChange={(e) => setPerformanceFilter(e.target.value as any)}
              className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-brand-dark cursor-pointer"
            >
              <option value="all">Performance: All Products</option>
              <option value="high">High Returns (≥ 5%)</option>
              <option value="low">Low Returns (&lt; 2%)</option>
              <option value="zero">Zero Returns (0%)</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-brand-dark cursor-pointer"
            >
              <option value="rate">Sort by: Highest Return Rate</option>
              <option value="returned">Sort by: Highest Returned Qty</option>
              <option value="delivered">Sort by: Most Orders Delivered</option>
              <option value="name">Sort by: Product Name</option>
            </select>
          </div>
        </div>

        {/* Product Table (Desktop) */}
        <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-500 font-black text-[10px] uppercase tracking-wider">
                <th className="py-3 px-4">Product Details</th>
                <th className="py-3 px-4 text-center">Orders Delivered</th>
                <th className="py-3 px-4 text-center">Customer Return</th>
                <th className="py-3 px-4 text-center">Status / Flag</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 text-xs">
                    No product return data matching current filters.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => (
                  <tr key={p.product_id} className="hover:bg-slate-50/80 transition">
                    {/* Product Details */}
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-3">
                        {p.image ? (
                          <img
                            src={p.image}
                            alt={p.product_name}
                            className="w-10 h-10 rounded-xl object-cover border border-slate-200 bg-slate-50 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                            <Package className="w-4 h-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-black text-slate-900 truncate max-w-xs">
                            {p.product_name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono font-bold">
                            SKU: {p.sku || "—"}
                          </p>
                          {p.category_name && (
                            <span className="text-[9px] text-slate-500">
                              Category: {p.category_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Orders Delivered */}
                    <td className="py-3 px-4 text-center">
                      <span className="font-mono font-bold text-slate-900 text-xs">
                        {p.orders_delivered}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        ({p.quantity_delivered} units)
                      </span>
                    </td>

                    {/* Customer Return */}
                    <td className="py-3 px-4 text-center">
                      <span className={`font-mono font-black text-xs ${
                        p.return_rate_percentage >= 5.0 ? "text-rose-600" : "text-slate-900"
                      }`}>
                        {p.return_rate_percentage}%
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        {p.quantity_returned} units returned
                      </span>
                    </td>

                    {/* Status Flag */}
                    <td className="py-3 px-4 text-center">
                      {p.is_high_return ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                          <AlertTriangle className="w-3 h-3 text-rose-500" />
                          <span>High Returns</span>
                        </span>
                      ) : p.returns_count === 0 ? (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>Zero Returns</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-slate-500">
                          Normal SLA
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic("selection");
                          setInspectProduct(p);
                        }}
                        className="px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Product Cards (Mobile < 768px) */}
        <div className="md:hidden space-y-3">
          {filteredProducts.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No product return records matching current filters.
            </div>
          ) : (
            filteredProducts.map((p) => (
              <div
                key={p.product_id}
                className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-2xs"
              >
                <div className="flex items-center space-x-3">
                  {p.image ? (
                    <img
                      src={p.image}
                      alt={p.product_name}
                      className="w-12 h-12 rounded-xl object-cover border border-slate-200 bg-slate-50 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                      <Package className="w-5 h-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-xs text-slate-900 truncate">
                      {p.product_name}
                    </p>
                    <p className="text-[10px] font-mono text-slate-400">SKU: {p.sku || "—"}</p>
                    {p.is_high_return && (
                      <span className="inline-block mt-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200">
                        High Returns Flag
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Orders Delivered</span>
                    <span className="font-black text-slate-800">{p.orders_delivered} ({p.quantity_delivered} pcs)</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Return Rate</span>
                    <span className={`font-black ${p.return_rate_percentage >= 5.0 ? "text-rose-600" : "text-slate-800"}`}>
                      {p.return_rate_percentage}% ({p.quantity_returned} returned)
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("selection");
                    setInspectProduct(p);
                  }}
                  className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition text-center cursor-pointer"
                >
                  View Details &amp; Returns
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Product Inspection Modal ── */}
      {inspectProduct && (
        <div
          className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setInspectProduct(null)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-3">
                {inspectProduct.image && (
                  <img
                    src={inspectProduct.image}
                    alt={inspectProduct.product_name}
                    className="w-10 h-10 rounded-xl object-cover border border-slate-200"
                  />
                )}
                <div>
                  <h3 className="text-sm font-black text-slate-900 truncate max-w-xs">
                    {inspectProduct.product_name}
                  </h3>
                  <p className="text-[11px] font-mono text-slate-400">
                    SKU: {inspectProduct.sku}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectProduct(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                <span className="text-[10px] text-slate-400 block">Orders Delivered</span>
                <span className="text-base font-black text-slate-900">{inspectProduct.orders_delivered}</span>
                <span className="text-[10px] text-slate-500 block">Delivered Units: {inspectProduct.quantity_delivered}</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                <span className="text-[10px] text-slate-400 block">Return Percentage</span>
                <span className={`text-base font-black ${
                  inspectProduct.return_rate_percentage >= 5 ? "text-rose-600" : "text-emerald-600"
                }`}>
                  {inspectProduct.return_rate_percentage}%
                </span>
                <span className="text-[10px] text-slate-500 block">Returned Units: {inspectProduct.quantity_returned}</span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 space-y-1">
              <p className="font-bold flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Quality Recommendation</span>
              </p>
              <p className="text-[11px] text-amber-800">
                {inspectProduct.return_rate_percentage >= 5
                  ? "Elevated return frequency detected. Inspect warehouse packaging, fragile padding, or contact supplier regarding batch defects."
                  : "Within healthy wholesale return boundaries. Keep active in catalog promotions."}
              </p>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setInspectProduct(null);
                  onSwitchToTracking(inspectProduct.sku);
                }}
                className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition text-center cursor-pointer"
              >
                View Returns for this SKU →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Return Assurance Information Dialog ── */}
      {assuranceModalOpen && (
        <div
          className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setAssuranceModalOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900">
                URT Return Assurance Policy
              </h3>
              <button
                type="button"
                onClick={() => setAssuranceModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <p>
                Under the URT Wholesale Return Assurance framework, sellers and wholesale buyers are protected against transit damage, wrong dispatches, and Dead-on-Arrival (DOA) units:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-700 font-medium">
                <li>Reverse logistics shipping fees are automatically subsidized for legitimate manufacturing defects.</li>
                <li>All returned items go through mandatory physical warehouse inspection (QC Passed or QC Failed).</li>
                <li>Approved returns automatically replenish live catalog inventory.</li>
                <li>QC-failed items unlock courier and OEM supplier claims with ticket tracking.</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => setAssuranceModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
