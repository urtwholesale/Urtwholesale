import { useState, useEffect } from "react";
import type {
  Order,
  OrderStatus,
  OrderEvent,
  CustomerLifetimeStats,
  StoreSettings,
} from "@urbanrat/shared";
import {
  ORDER_STATUS_BADGES,
  generatePackingSlipHtml,
} from "@urbanrat/shared";
import {
  adminUpdateOrderStatus,
  adminUpdateOrderShipping,
  fetchOrderEvents,
  fetchCustomerLifetimeStats,
  fetchStoreSettings,
} from "../../lib/adminService";
import {
  X,
  AlertTriangle,
  Check,
  Loader2,
  MapPin,
  History,
  Truck,
  FileText,
  Printer,
  MessageCircle,
  Copy,
  ExternalLink,
  ShieldCheck,
  User,
  Sparkles,
  Clock,
  Package,
  XCircle,
} from "lucide-react";

interface OrderDetailModalProps {
  order: Order;
  onClose: () => void;
  onUpdated: () => void;
}

const ALLOWED_STATUS_OPTIONS: { value: OrderStatus; label: string; desc: string }[] = [
  { value: "pending", label: "Pending Verification", desc: "Awaiting wholesale stock and payment review" },
  { value: "confirmed", label: "Order Confirmed", desc: "Inventory locked; ready for warehouse picking" },
  { value: "processing", label: "Processing & QC Boxing", desc: "Items undergoing boxing and carton packing" },
  { value: "shipped", label: "Dispatched / Shipped", desc: "Handed over to carrier freight with AWB tracking" },
  { value: "delivered", label: "Delivered to Customer", desc: "Consignment successfully delivered" },
  { value: "on_hold", label: "On Hold", desc: "Pending address/payment confirmation with customer" },
  { value: "cancelled", label: "Cancelled (Restores Stock)", desc: "Order voided; automatically restocks database units" },
  { value: "refunded", label: "Refunded (Restores Stock)", desc: "Payment returned; automatically restocks database units" },
];

const COURIER_PRESETS = [
  "Delhivery Express",
  "Blue Dart Freight",
  "DTDC Express",
  "Express Cargo",
  "Trackon Courier",
  "India Post Speed Post",
  "Shadowfax",
  "VRL Logistics",
  "Other Carrier",
];

export function OrderDetailModal({
  order,
  onClose,
  onUpdated,
}: OrderDetailModalProps) {
  // Status transition state
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>(order.status);
  const [statusNote, setStatusNote] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusSuccess, setStatusSuccess] = useState<string | null>(null);

  // Shipping & Tracking state
  const [courierName, setCourierName] = useState(order.courier_name || "");
  const [awbNumber, setAwbNumber] = useState(order.awb_number || "");
  const [updatingShipping, setUpdatingShipping] = useState(false);
  const [shippingSuccess, setShippingSuccess] = useState<string | null>(null);

  // Internal Notes state
  const [internalNote, setInternalNote] = useState(order.admin_note || "");
  const [updatingNote, setUpdatingNote] = useState(false);
  const [noteSuccess, setNoteSuccess] = useState<string | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState(false);

  // Error feedback
  const [error, setError] = useState<string | null>(null);

  // Copy feedback
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Audit Events
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  // Customer Lifetime Stats
  const [lifetimeStats, setLifetimeStats] = useState<CustomerLifetimeStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Store settings for invoices
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);

  useEffect(() => {
    // Load events
    fetchOrderEvents(order.id)
      .then(setEvents)
      .catch(console.error)
      .finally(() => setLoadingEvents(false));

    // Load customer lifetime stats
    fetchCustomerLifetimeStats(order.customer?.phone, order.user_id || undefined)
      .then(setLifetimeStats)
      .catch(console.error)
      .finally(() => setLoadingStats(false));

    // Load store settings for printing
    fetchStoreSettings()
      .then(setStoreSettings)
      .catch(console.error);
  }, [order.id, order.customer?.phone, order.user_id]);

  function handleCopy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  }

  // 1. Status Transition Submission
  async function handleStatusChange(e: React.FormEvent) {
    e.preventDefault();
    if (selectedStatus === order.status && !statusNote) return;

    setUpdatingStatus(true);
    setError(null);
    setStatusSuccess(null);

    try {
      const res = await adminUpdateOrderStatus(
        order.id,
        selectedStatus,
        statusNote.trim() || undefined
      );

      const restoreNotice =
        res?.items_restored > 0
          ? ` (${res.items_restored} item units returned to inventory)`
          : "";

      setStatusSuccess(`Status transitioned to "${selectedStatus}" successfully!${restoreNotice}`);
      setStatusNote("");
      onUpdated();

      // Refresh events
      fetchOrderEvents(order.id).then(setEvents).catch(console.error);
    } catch (err: any) {
      console.error("Status update error:", err);
      setError(err?.message || "Failed to update order status via RPC.");
    } finally {
      setUpdatingStatus(false);
    }
  }

  // Direct Cancellation Action
  async function handleDirectCancel() {
    if (order.status === "cancelled") return;
    const reason = window.prompt(
      `Cancel Order #${order.id} for ${order.customer?.name || "Customer"}?\n\nThis will void the order and return all units back to stock.\n\nCancellation note (optional):`,
      "Cancelled by admin"
    );
    if (reason === null) return;

    setCancellingOrder(true);
    setError(null);
    setStatusSuccess(null);
    try {
      const res = await adminUpdateOrderStatus(
        order.id,
        "cancelled",
        reason.trim() || "Cancelled by admin"
      );
      const restoreNotice =
        res?.items_restored > 0
          ? ` (${res.items_restored} item units returned to inventory)`
          : "";
      setStatusSuccess(`Order #${order.id} cancelled successfully!${restoreNotice}`);
      setSelectedStatus("cancelled");
      onUpdated();
      fetchOrderEvents(order.id).then(setEvents).catch(console.error);
    } catch (err: any) {
      console.error("Cancel order error:", err);
      setError(err?.message || "Failed to cancel order.");
    } finally {
      setCancellingOrder(false);
    }
  }

  // 2. Shipping Details Submission
  async function handleShippingUpdate(e: React.FormEvent) {
    e.preventDefault();
    setUpdatingShipping(true);
    setError(null);
    setShippingSuccess(null);

    try {
      await adminUpdateOrderShipping(
        order.id,
        courierName.trim(),
        awbNumber.trim(),
        `Tracking updated: ${courierName.trim() || "Carrier"} (AWB: ${awbNumber.trim() || "—"})`
      );

      setShippingSuccess("Carrier tracking and AWB saved successfully!");
      onUpdated();

      // Refresh events
      fetchOrderEvents(order.id).then(setEvents).catch(console.error);
    } catch (err: any) {
      console.error("Shipping update error:", err);
      setError(err?.message || "Failed to save carrier and AWB details.");
    } finally {
      setUpdatingShipping(false);
    }
  }

  // 3. Internal Note Submission
  async function handleNoteSave(e: React.FormEvent) {
    e.preventDefault();
    setUpdatingNote(true);
    setError(null);
    setNoteSuccess(null);

    try {
      await adminUpdateOrderStatus(order.id, order.status, internalNote.trim());
      setNoteSuccess("Internal warehouse note saved.");
      onUpdated();
      fetchOrderEvents(order.id).then(setEvents).catch(console.error);
    } catch (err: any) {
      setError(err?.message || "Failed to save note.");
    } finally {
      setUpdatingNote(false);
    }
  }

  // 4. Print Packing Slip
  function handlePrintPackingSlip() {
    const html = generatePackingSlipHtml(
      {
        ...order,
        courier_name: courierName || order.courier_name,
        awb_number: awbNumber || order.awb_number,
      },
      storeSettings
    );

    const win = window.open("", "_blank");
    if (!win) {
      alert("Please allow popups to generate and print packing slips.");
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  // 5. Print GST Invoice
  function handlePrintInvoice() {
    const invoiceWindow = window.open("", "_blank");
    if (!invoiceWindow) {
      alert("Please allow popups to view and download invoices.");
      return;
    }

    const subtotal = order.subtotal || order.total;
    const savings = order.savings || 0;
    const shipping = order.shipping || 0;
    const total = order.total;
    const taxableBase = Math.round((subtotal / 1.18) * 100) / 100;
    const gstAmount = Math.round((subtotal - taxableBase) * 100) / 100;
    const cgst = Math.round((gstAmount / 2) * 100) / 100;
    const sgst = Math.round((gstAmount / 2) * 100) / 100;

    const itemsHtml = (order.items || [])
      .map((item, index) => {
        const unitPrice = item.unit_price || item.price || 0;
        const lineTotal = item.line_total || unitPrice * item.quantity;
        return `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 8px; text-align: center; color: #64748b; font-size: 12px;">${index + 1}</td>
            <td style="padding: 10px 8px;">
              <div style="font-weight: 600; font-size: 13px; color: #1e293b;">${item.name}</div>
              <div style="font-size: 11px; color: #64748b; margin-top: 2px;">SKU: <b>${item.sku || "—"}</b></div>
            </td>
            <td style="padding: 10px 8px; text-align: center; font-weight: 600; font-size: 13px;">${item.quantity}</td>
            <td style="padding: 10px 8px; text-align: right; font-size: 13px;">₹${unitPrice.toLocaleString("en-IN")}</td>
            <td style="padding: 10px 8px; text-align: right; font-weight: 700; font-size: 13px; color: #0f172a;">₹${lineTotal.toLocaleString("en-IN")}</td>
          </tr>
        `;
      })
      .join("");

    invoiceWindow.document.open();
    invoiceWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>GST Tax Invoice - ${order.id}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 0; padding: 24px; background: #fff; }
          .invoice-card { max-width: 800px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; padding: 32px; }
          @media print { body { padding: 0; } .invoice-card { border: none; padding: 0; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="no-print" style="max-width: 800px; margin: 0 auto 16px; text-align: right;">
          <button onclick="window.print()" style="background: #0A82A8; color: white; border: none; padding: 10px 20px; font-weight: bold; border-radius: 8px; cursor: pointer;">
            🖨️ Print / Save as PDF
          </button>
        </div>
        <div class="invoice-card">
          <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 20px;">
            <div>
              <h1 style="margin: 0; font-size: 22px; font-weight: 900; color: #0A82A8;">URT WHOLESALE</h1>
              <p style="margin: 4px 0 0; font-size: 12px; color: #475569;">Urbanrat Technologies Private Limited</p>
              <p style="margin: 2px 0 0; font-size: 12px; color: #64748b;">GSTIN: <b>27AAPFU0939F1ZV</b></p>
            </div>
            <div style="text-align: right;">
              <h2 style="margin: 0; font-size: 18px; font-weight: 800; color: #0f172a;">TAX INVOICE</h2>
              <p style="margin: 4px 0 0; font-family: monospace; font-size: 13px; font-weight: 700;">INV-${order.id}</p>
              <p style="margin: 2px 0 0; font-size: 12px; color: #64748b;">Date: ${new Date(order.created_at).toLocaleDateString("en-IN")}</p>
            </div>
          </div>
          <div style="margin: 20px 0; padding: 14px; background: #f8fafc; border-radius: 8px; font-size: 12px;">
            <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Billed / Shipped To:</div>
            <div style="font-size: 14px; font-weight: 800; margin-top: 4px; color: #0f172a;">${order.customer?.name || "Customer"}</div>
            ${order.customer?.business_name ? `<div style="font-weight: 700; color: #334155;">${order.customer.business_name}</div>` : ""}
            ${order.customer?.gstin ? `<div style="font-weight: 700; color: #0369a1;">GSTIN: ${order.customer.gstin}</div>` : ""}
            <div style="margin-top: 4px; color: #475569;">${order.customer?.address || "—"} ${order.customer?.pincode ? `(PIN: ${order.customer.pincode})` : ""}</div>
            <div style="margin-top: 4px; font-weight: 700;">Phone: +91 ${order.customer?.phone || "—"}</div>
          </div>
          <table style="width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px;">
            <thead>
              <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; font-size: 11px; text-transform: uppercase; color: #475569;">
                <th style="padding: 10px 8px; text-align: center;">#</th>
                <th style="padding: 10px 8px; text-align: left;">Item Description</th>
                <th style="padding: 10px 8px; text-align: center;">Qty</th>
                <th style="padding: 10px 8px; text-align: right;">Unit Rate</th>
                <th style="padding: 10px 8px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          <div style="margin-top: 24px; display: flex; justify-content: flex-end;">
            <div style="width: 280px; font-size: 12px; line-height: 1.8;">
              <div style="display: flex; justify-content: space-between;"><span>Taxable Base:</span><span>₹${taxableBase.toLocaleString("en-IN")}</span></div>
              <div style="display: flex; justify-content: space-between;"><span>CGST (9%):</span><span>₹${cgst.toLocaleString("en-IN")}</span></div>
              <div style="display: flex; justify-content: space-between;"><span>SGST (9%):</span><span>₹${sgst.toLocaleString("en-IN")}</span></div>
              ${savings > 0 ? `<div style="display: flex; justify-content: space-between; color: #059669; font-weight: 600;"><span>Volume Tier Savings:</span><span>-₹${savings.toLocaleString("en-IN")}</span></div>` : ""}
              <div style="display: flex; justify-content: space-between;"><span>Shipping:</span><span>${shipping ? `₹${shipping}` : "FREE"}</span></div>
              <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 900; border-top: 2px solid #0f172a; padding-top: 6px; margin-top: 6px;">
                <span>Grand Total:</span><span>₹${total.toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>
          <div style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 11px; color: #64748b; text-align: center;">
            This is a computer generated invoice issued by URT Wholesale. Standard 1-Year Wholesale Warranty applies.
          </div>
        </div>
      </body>
      </html>
    `);
    invoiceWindow.document.close();
  }

  // 6. WhatsApp Customer Deep Link
  const customerPhoneRaw = (order.customer?.phone || "").replace(/\D/g, "").slice(-10);
  const whatsappUrl = customerPhoneRaw
    ? `https://wa.me/91${customerPhoneRaw}?text=${encodeURIComponent(
        `Hello ${order.customer?.name || "Customer"}, regarding your URT Wholesale Order #${order.id}: Current Status is *${order.status.toUpperCase()}*. ${
          order.awb_number ? `Dispatched via ${order.courier_name || "Express Courier"} AWB #${order.awb_number}.` : ""
        } Please let us know if you need any assistance!`
      )}`
    : null;

  const statusBadge = ORDER_STATUS_BADGES[order.status] || {
    label: order.status,
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-200",
    dot: "bg-slate-400",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-100 max-h-[92vh] flex flex-col my-auto overflow-hidden animate-in fade-in duration-200">
        {/* ── Top Header Bar ── */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h3 className="text-base sm:text-lg font-black font-mono text-slate-900">
              #{order.id}
            </h3>

            <button
              type="button"
              onClick={() => handleCopy(order.id, "order_id")}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              title="Copy Order ID"
            >
              {copiedField === "order_id" ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>

            <span
              className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusBadge.bg} ${statusBadge.text} ${statusBadge.border}`}
            >
              <span className={`w-2 h-2 rounded-full ${statusBadge.dot}`} />
              <span className="capitalize">{statusBadge.label}</span>
            </span>

            {/* Source Pill */}
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 capitalize">
              Source: {order.source || "Website"}
            </span>

            {/* Payment Status Pill */}
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border capitalize ${
                order.payment_status === "paid"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : order.payment_status === "cod"
                  ? "bg-blue-50 text-blue-800 border-blue-200"
                  : "bg-amber-50 text-amber-800 border-amber-200"
              }`}
            >
              Payment: {order.payment_status || "Pending"}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Scrollable Modal Body ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
              {error}
            </div>
          )}

          {/* ── Customer Lifetime Stats Strip (Requirement 7) ── */}
          <div className="p-4 rounded-2xl bg-linear-to-r from-sky-50 via-slate-50 to-indigo-50/50 border border-sky-100/80 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-brand-light/20 text-brand-dark flex items-center justify-center shrink-0">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm text-slate-900">
                      {order.customer?.name || "Wholesale Buyer"}
                    </span>
                    {lifetimeStats && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-brand-dark text-white">
                        {lifetimeStats.total_orders > 3 || lifetimeStats.total_spend >= 50000
                          ? "VIP Wholesale Account"
                          : lifetimeStats.total_orders > 1
                          ? "Repeat Customer"
                          : "First-Time Buyer"}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {order.customer?.business_name ? (
                      <strong className="text-slate-800 font-bold">{order.customer.business_name} &bull; </strong>
                    ) : null}
                    +91 {order.customer?.phone || "—"}
                  </p>
                </div>
              </div>

              {/* Stats badges */}
              <div className="flex items-center gap-3 sm:gap-5 text-left sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200/60">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Lifetime Orders
                  </span>
                  <span className="font-black text-sm text-slate-900">
                    {loadingStats ? "..." : `${lifetimeStats?.total_orders || 1} orders`}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Lifetime Spend
                  </span>
                  <span className="font-black text-sm text-emerald-700">
                    {loadingStats ? "..." : `₹${(lifetimeStats?.total_spend || order.total).toLocaleString("en-IN")}`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Document Actions & WhatsApp Bar ── */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70">
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              {/* Print GST Invoice */}
              <button
                type="button"
                onClick={handlePrintInvoice}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs border border-slate-200 shadow-2xs transition active:scale-95 flex items-center space-x-1.5 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-brand-dark" />
                <span>Print GST Invoice</span>
              </button>

              {/* Print Packing Slip */}
              <button
                type="button"
                onClick={handlePrintPackingSlip}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs border border-slate-200 shadow-2xs transition active:scale-95 flex items-center space-x-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-indigo-600" />
                <span>Print Packing Slip</span>
              </button>

              {/* Direct Cancel Order Button */}
              {selectedStatus !== "cancelled" ? (
                <button
                  type="button"
                  disabled={cancellingOrder}
                  onClick={handleDirectCancel}
                  className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 shadow-2xs transition active:scale-95 flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {cancellingOrder ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Cancelling...</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span>Cancel Order</span>
                    </>
                  )}
                </button>
              ) : (
                <span className="px-3 py-1.5 rounded-xl bg-rose-100 text-rose-800 text-xs font-black inline-flex items-center space-x-1 border border-rose-200">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Order Cancelled</span>
                </span>
              )}
            </div>

            {/* WhatsApp Communication */}
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition active:scale-95 flex items-center space-x-1.5 cursor-pointer"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Message Customer on WhatsApp</span>
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>
            )}
          </div>

          {/* ── Two Column Grid: Shipping/AWB & Status Transition ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
            {/* ── Shipping & Tracking Controls ── */}
            <div className="p-4.5 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h4 className="font-black text-xs uppercase tracking-wider text-slate-900 flex items-center space-x-1.5">
                  <Truck className="w-4 h-4 text-indigo-600" />
                  <span>Courier &amp; AWB Tracking</span>
                </h4>
                {order.awb_number && (
                  <span className="font-mono text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    AWB Active
                  </span>
                )}
              </div>

              {shippingSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center space-x-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{shippingSuccess}</span>
                </div>
              )}

              <form onSubmit={handleShippingUpdate} className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Logistics / Freight Carrier
                  </label>
                  <div className="space-y-1.5">
                    <select
                      value={courierName}
                      onChange={(e) => setCourierName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-brand-light"
                    >
                      <option value="">Select Carrier...</option>
                      {COURIER_PRESETS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={courierName}
                      onChange={(e) => setCourierName(e.target.value)}
                      placeholder="Or type custom courier name..."
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-light"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Air Waybill / Consignment Tracking (AWB #)
                  </label>
                  <input
                    type="text"
                    value={awbNumber}
                    onChange={(e) => setAwbNumber(e.target.value)}
                    placeholder="e.g. DEL-748291039 or SFX-94829"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono uppercase text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-light"
                  />
                </div>

                <div className="pt-1 flex justify-end">
                  <button
                    type="submit"
                    disabled={updatingShipping}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition active:scale-95 disabled:opacity-40 cursor-pointer flex items-center space-x-1.5"
                  >
                    {updatingShipping ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving Tracking...</span>
                      </>
                    ) : (
                      <span>Save Courier &amp; AWB</span>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* ── Status Transition Controls (Strict RPC) ── */}
            <div className="p-4.5 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h4 className="font-black text-xs uppercase tracking-wider text-slate-900 flex items-center space-x-1.5">
                  <Clock className="w-4 h-4 text-brand-dark" />
                  <span>Lifecycle Status Transition (RPC)</span>
                </h4>
              </div>

              {statusSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center space-x-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{statusSuccess}</span>
                </div>
              )}

              <form onSubmit={handleStatusChange} className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Target Order Status
                  </label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value as OrderStatus)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-brand-light"
                  >
                    {ALLOWED_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label} — {opt.desc}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Event / Transition Note (Optional)
                  </label>
                  <input
                    type="text"
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    placeholder="e.g. Verified payment slip via NEFT"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-light"
                  />
                </div>

                {(selectedStatus === "cancelled" || selectedStatus === "refunded") && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold flex items-center space-x-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      Restoring inventory: Transitioning to &quot;{selectedStatus}&quot; will automatically return ordered units back to catalog stock.
                    </span>
                  </div>
                )}

                <div className="pt-1 flex justify-end">
                  <button
                    type="submit"
                    disabled={updatingStatus || (selectedStatus === order.status && !statusNote)}
                    className="px-4 py-2 rounded-xl text-white font-bold text-xs shadow-xs transition active:scale-95 disabled:opacity-40 cursor-pointer flex items-center space-x-1.5 bg-linear-to-b from-brand-light to-brand-dark"
                  >
                    {updatingStatus ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Updating Status...</span>
                      </>
                    ) : (
                      <span>Update Status</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* ── Ordered Line Items & Tier Pricing ── */}
          <div className="p-4.5 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-3">
            <h4 className="font-black text-xs uppercase tracking-wider text-slate-900 flex items-center space-x-1.5">
              <Package className="w-4 h-4 text-brand-dark" />
              <span>Line Items &amp; Wholesale Volume Tiers ({order.items?.length || 0})</span>
            </h4>

            <div className="divide-y divide-slate-100 overflow-x-auto">
              {order.items?.map((item, idx) => {
                const unitPrice = item.unit_price || item.price || 0;
                const lineTotal = item.line_total || unitPrice * item.quantity;

                return (
                  <div key={idx} className="py-3 flex items-center justify-between text-xs gap-3">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-6 h-6 text-slate-300" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 line-clamp-1">{item.name}</p>
                        <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5">
                          {item.sku && <span className="font-mono">SKU: {item.sku}</span>}
                          {item.tier_min_qty && (
                            <span className="inline-flex items-center space-x-1 px-1.5 py-0.2 rounded bg-sky-50 text-sky-800 font-bold border border-sky-100">
                              <Sparkles className="w-3 h-3 text-sky-600" />
                              <span>Tier {item.tier_min_qty}+ pcs</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-black text-slate-900 text-sm">
                        ₹{lineTotal.toLocaleString("en-IN")}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        <strong>{item.quantity} pcs</strong> × ₹{unitPrice.toLocaleString("en-IN")}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Financial Summary */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-2 text-xs">
              <div className="text-[11px] text-slate-400">
                All prices inclusive of 18% GST (9% CGST + 9% SGST)
              </div>
              <div className="w-full sm:w-64 space-y-1 text-right text-slate-600">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-bold text-slate-800">
                    ₹{(order.subtotal || order.total).toLocaleString("en-IN")}
                  </span>
                </div>
                {order.savings !== undefined && order.savings > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Wholesale Tier Savings:</span>
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
                  <span>Total Paid:</span>
                  <span>₹{order.total.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Destination Address & Internal Notes ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Delivery Address Card */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-400 uppercase text-[10px] flex items-center space-x-1">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Delivery Address</span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      `${order.customer?.name}\n${order.customer?.address}\nPincode: ${order.customer?.pincode}\nPhone: ${order.customer?.phone}`,
                      "address"
                    )
                  }
                  className="text-[11px] font-bold text-brand-dark hover:underline flex items-center space-x-1 cursor-pointer"
                >
                  {copiedField === "address" ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Address</span>
                    </>
                  )}
                </button>
              </div>

              <div className="space-y-1">
                <p className="font-bold text-slate-900">{order.customer?.name}</p>
                {order.customer?.business_name && (
                  <p className="font-semibold text-slate-700">{order.customer.business_name}</p>
                )}
                {order.customer?.gstin && (
                  <p className="font-mono text-[11px] text-slate-500">GSTIN: {order.customer.gstin}</p>
                )}
                <p className="text-slate-600 leading-relaxed font-normal">
                  {order.customer?.address || "Address on record"}
                  {order.customer?.pincode && `, PIN: ${order.customer.pincode}`}
                </p>
                <p className="font-mono text-slate-800 font-bold pt-0.5">
                  Phone: +91 {order.customer?.phone || "—"}
                </p>
              </div>
            </div>

            {/* Internal Notes Card */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-400 uppercase text-[10px] flex items-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Internal Warehouse Notes</span>
                </span>
                {noteSuccess && <span className="text-[11px] text-emerald-600 font-bold">{noteSuccess}</span>}
              </div>

              <form onSubmit={handleNoteSave} className="space-y-2">
                <textarea
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                  placeholder="Private warehouse remarks, carrier remarks, packaging instructions..."
                  rows={3}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-light"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={updatingNote}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
                  >
                    {updatingNote ? "Saving..." : "Save Note"}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* ── Order Audit Events Timeline ── */}
          <div className="p-4.5 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-3">
            <h4 className="font-black text-xs uppercase tracking-wider text-slate-900 flex items-center space-x-1.5">
              <History className="w-4 h-4 text-brand-dark" />
              <span>Order Audit Events Timeline ({events.length})</span>
            </h4>

            {loadingEvents ? (
              <div className="p-4 text-center text-xs text-slate-400">Loading order events...</div>
            ) : events.length > 0 ? (
              <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {events.map((ev, idx) => (
                  <div key={ev.id || idx} className="relative">
                    <span className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-brand-dark border-2 border-white ring-2 ring-brand-light/30" />
                    <div className="text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900 capitalize">{ev.status}</span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(ev.created_at).toLocaleString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {ev.note && <p className="text-slate-600 text-[11px] mt-0.5">{ev.note}</p>}
                    </div>
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
