import type {
  Order,
  OrderSource,
  PaymentStatus,
  CustomerLifetimeStats,
} from "./types/order";
import type { StoreSettings } from "./types/storeSettings";

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Pending Verification",
  confirmed: "Confirmed",
  processing: "Processing & Boxing",
  shipped: "Shipped / In Transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
  returned: "Returned / Replaced",
  on_hold: "On Hold",
};

export const ORDER_STATUS_BADGES: Record<
  string,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  pending: {
    label: "Pending",
    bg: "bg-amber-50",
    text: "text-amber-800",
    border: "border-amber-200",
    dot: "bg-amber-500",
  },
  confirmed: {
    label: "Confirmed",
    bg: "bg-blue-50",
    text: "text-blue-800",
    border: "border-blue-200",
    dot: "bg-blue-500",
  },
  processing: {
    label: "Processing",
    bg: "bg-purple-50",
    text: "text-purple-800",
    border: "border-purple-200",
    dot: "bg-purple-500",
  },
  shipped: {
    label: "Shipped",
    bg: "bg-indigo-50",
    text: "text-indigo-800",
    border: "border-indigo-200",
    dot: "bg-indigo-500",
  },
  delivered: {
    label: "Delivered",
    bg: "bg-emerald-50",
    text: "text-emerald-800",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
  },
  cancelled: {
    label: "Cancelled",
    bg: "bg-rose-50",
    text: "text-rose-800",
    border: "border-rose-200",
    dot: "bg-rose-500",
  },
  refunded: {
    label: "Refunded",
    bg: "bg-slate-100",
    text: "text-slate-800",
    border: "border-slate-300",
    dot: "bg-slate-500",
  },
  returned: {
    label: "Returned",
    bg: "bg-amber-100",
    text: "text-amber-900",
    border: "border-amber-300",
    dot: "bg-amber-600",
  },
  on_hold: {
    label: "On Hold",
    bg: "bg-orange-50",
    text: "text-orange-800",
    border: "border-orange-200",
    dot: "bg-orange-500",
  },
};

export type SellerHubTab =
  | "all"
  | "pending"
  | "ready_to_ship"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "on_hold";

export interface OrderFilterOptions {
  tab?: SellerHubTab;
  search?: string;
  source?: OrderSource | "all";
  paymentStatus?: PaymentStatus | "all";
  dateRange?: "all" | "today" | "yesterday" | "7_days" | "30_days" | "this_month" | "custom";
  startDate?: string;
  endDate?: string;
}

/**
 * Checks if an order matches a given tab
 */
export function matchesOrderTab(order: Order, tab: SellerHubTab): boolean {
  if (tab === "all") return true;
  const st = (order.status || "pending").toLowerCase();

  switch (tab) {
    case "pending":
      return st === "pending";
    case "ready_to_ship":
      return st === "confirmed" || st === "processing";
    case "shipped":
      return st === "shipped";
    case "delivered":
      return st === "delivered";
    case "cancelled":
      return st === "cancelled" || st === "refunded";
    case "on_hold":
      return st === "on_hold";
    default:
      return true;
  }
}

/**
 * Filter an array of orders using the Seller Hub filter options
 */
export function filterOrders(orders: Order[], filters: OrderFilterOptions): Order[] {
  const searchClean = (filters.search || "").trim().toLowerCase();
  const source = filters.source || "all";
  const paymentStatus = filters.paymentStatus || "all";
  const tab = filters.tab || "all";
  const dateRange = filters.dateRange || "all";

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400000;
  const sevenDaysAgo = now.getTime() - 7 * 86400000;
  const thirtyDaysAgo = now.getTime() - 30 * 86400000;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  return orders.filter((order) => {
    // 1. Tab filter
    if (!matchesOrderTab(order, tab)) return false;

    // 2. Source filter
    if (source !== "all") {
      const orderSrc = (order.source || "website").toLowerCase();
      if (orderSrc !== source.toLowerCase()) return false;
    }

    // 3. Payment Status filter
    if (paymentStatus !== "all") {
      const orderPayment = (order.payment_status || "pending").toLowerCase();
      if (orderPayment !== paymentStatus.toLowerCase()) return false;
    }

    // 4. Date range filter
    if (dateRange !== "all") {
      const orderTime = new Date(order.created_at).getTime();
      switch (dateRange) {
        case "today":
          if (orderTime < startOfToday) return false;
          break;
        case "yesterday":
          if (orderTime < startOfYesterday || orderTime >= startOfToday) return false;
          break;
        case "7_days":
          if (orderTime < sevenDaysAgo) return false;
          break;
        case "30_days":
          if (orderTime < thirtyDaysAgo) return false;
          break;
        case "this_month":
          if (orderTime < startOfMonth) return false;
          break;
        case "custom":
          if (filters.startDate && orderTime < new Date(filters.startDate).getTime()) return false;
          if (filters.endDate && orderTime > new Date(filters.endDate).getTime() + 86400000) return false;
          break;
      }
    }

    // 5. Search filter (order code, customer name, phone, business name, or SKU)
    if (searchClean) {
      const orderIdMatch = order.id.toLowerCase().includes(searchClean);
      const custNameMatch = (order.customer?.name || "").toLowerCase().includes(searchClean);
      const custPhoneMatch = (order.customer?.phone || "").toLowerCase().includes(searchClean);
      const custBusinessMatch = (order.customer?.business_name || "").toLowerCase().includes(searchClean);
      const skuMatch = (order.items || []).some((item) =>
        (item.sku || "").toLowerCase().includes(searchClean) ||
        (item.name || "").toLowerCase().includes(searchClean)
      );

      if (!orderIdMatch && !custNameMatch && !custPhoneMatch && !custBusinessMatch && !skuMatch) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Calculates customer lifetime stats from an array of orders
 */
export function calculateCustomerLifetimeStats(
  orders: Order[],
  phone?: string,
  userId?: string | null
): CustomerLifetimeStats {
  const cleanPhone = (phone || "").replace(/\D/g, "").slice(-10);

  const matched = orders.filter((o) => {
    if (userId && o.user_id === userId) return true;
    if (cleanPhone && (o.customer?.phone || "").replace(/\D/g, "").slice(-10) === cleanPhone) {
      return true;
    }
    return false;
  });

  const validSpendOrders = matched.filter(
    (o) => o.status !== "cancelled" && o.status !== "refunded"
  );
  const totalSpend = validSpendOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const deliveredOrders = matched.filter((o) => o.status === "delivered").length;

  const dates = matched.map((o) => new Date(o.created_at).getTime()).sort((a, b) => a - b);

  return {
    total_orders: matched.length,
    total_spend: totalSpend,
    delivered_orders: deliveredOrders,
    first_order_date:
      dates.length > 0 && typeof dates[0] === "number"
        ? new Date(dates[0]).toISOString()
        : null,
    last_order_date:
      dates.length > 0 && typeof dates[dates.length - 1] === "number"
        ? new Date(dates[dates.length - 1] as number).toISOString()
        : null,
  };
}

/**
 * Generates print-ready HTML for a warehouse packing slip
 */
export function generatePackingSlipHtml(order: Order, settings?: StoreSettings | null): string {
  const storeName = settings?.store_name || settings?.store_info?.name || "URT Wholesale";
  const dateStr = new Date(order.created_at).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const itemsRows = (order.items || [])
    .map(
      (item, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 8px; text-align: center; font-size: 13px;">[ ]</td>
        <td style="padding: 10px 8px; text-align: center; color: #64748b; font-size: 12px;">${idx + 1}</td>
        <td style="padding: 10px 8px;">
          <div style="font-weight: 700; font-size: 13px; color: #0f172a;">${item.name}</div>
          <div style="font-size: 11px; color: #64748b; font-family: monospace;">SKU: ${item.sku || "—"}</div>
        </td>
        <td style="padding: 10px 8px; text-align: center; font-weight: 800; font-size: 14px;">${item.quantity} pcs</td>
        <td style="padding: 10px 8px; text-align: center; font-size: 12px; color: #64748b;">[ &nbsp; &nbsp; &nbsp; ]</td>
      </tr>
    `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Packing Slip - ${order.id}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          color: #0f172a;
          margin: 0;
          padding: 24px;
          background: #ffffff;
        }
        .slip-box {
          max-width: 800px;
          margin: 0 auto;
          border: 2px dashed #94a3b8;
          border-radius: 8px;
          padding: 24px;
        }
        @media print {
          body { padding: 0; }
          .slip-box { border: 1px solid #000; padding: 16px; max-width: 100%; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="max-width: 800px; margin: 0 auto 16px; text-align: right;">
        <button onclick="window.print()" style="background: #0A82A8; color: white; border: none; padding: 8px 16px; font-weight: bold; border-radius: 6px; cursor: pointer;">
          Print Packing Slip
        </button>
      </div>

      <div class="slip-box">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px;">
          <div>
            <h1 style="margin: 0; font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;">${storeName}</h1>
            <p style="margin: 4px 0 0; font-size: 12px; font-weight: 700; color: #475569;">WAREHOUSE PACKING SLIP &amp; MANIFEST</p>
          </div>
          <div style="text-align: right;">
            <div style="font-family: monospace; font-size: 16px; font-weight: 900; background: #0f172a; color: white; padding: 4px 10px; border-radius: 4px;">
              #${order.id}
            </div>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Date: ${dateStr}</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 16px 0; padding: 12px; background: #f8fafc; border-radius: 6px; font-size: 12px;">
          <div>
            <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b;">SHIP TO CUSTOMER:</div>
            <div style="font-size: 14px; font-weight: 800; margin-top: 2px; color: #0f172a;">${order.customer?.name || "Customer"}</div>
            ${order.customer?.business_name ? `<div style="font-weight: 700; color: #334155;">${order.customer.business_name}</div>` : ""}
            <div style="margin-top: 4px; line-height: 1.4; color: #475569;">
              ${order.customer?.address || "Address on file"}<br/>
              ${order.customer?.pincode ? `<b>PINCODE: ${order.customer.pincode}</b>` : ""}
            </div>
            <div style="margin-top: 4px; font-weight: 700;">Phone: +91 ${order.customer?.phone || "—"}</div>
          </div>

          <div style="border-left: 1px solid #e2e8f0; padding-left: 16px;">
            <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b;">CARRIER &amp; LOGISTICS:</div>
            <div style="font-size: 13px; font-weight: 700; margin-top: 4px;">Courier: <b>${order.courier_name || "Express Surface Cargo"}</b></div>
            <div style="font-size: 13px; font-family: monospace; margin-top: 2px;">AWB #: <b>${order.awb_number || "PENDING"}</b></div>
            <div style="font-size: 12px; margin-top: 4px;">Source: <b style="text-transform: capitalize;">${order.source || "Website"}</b></div>
            <div style="font-size: 12px; margin-top: 2px;">Total Box Units: <b>${(order.items || []).reduce((acc, i) => acc + (i.quantity || 0), 0)} pcs</b></div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px;">
          <thead>
            <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-transform: uppercase; font-size: 10px; font-weight: 800; color: #475569;">
              <th style="padding: 8px; width: 36px; text-align: center;">Check</th>
              <th style="padding: 8px; width: 32px; text-align: center;">#</th>
              <th style="padding: 8px; text-align: left;">Product Description / SKU</th>
              <th style="padding: 8px; width: 90px; text-align: center;">Quantity</th>
              <th style="padding: 8px; width: 70px; text-align: center;">QC Pass</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 32px; padding-top: 16px; border-top: 1px solid #cbd5e1; font-size: 11px; color: #64748b;">
          <div>
            <div>Packer Name: _______________________</div>
            <div style="margin-top: 4px;">Verified Box Weight: ________ kg</div>
          </div>
          <div style="text-align: right;">
            <div>Quality Inspector Signature: _______________________</div>
            <div style="margin-top: 4px;">Handover Date &amp; Time: _______________________</div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}
