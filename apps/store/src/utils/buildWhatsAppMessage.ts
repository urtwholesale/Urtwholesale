export interface WhatsAppItem {
  product?: {
    name: string;
    price: number;
  };
  name?: string;
  price?: number;
  quantity: number;
}

export interface CustomerInfo {
  name?: string;
  phone?: string;
  address?: string;
}

export interface BuildWhatsAppMessageOptions {
  orderId?: string;
  items: WhatsAppItem[];
  subtotal?: number;
  savings?: number;
  shipping?: number | string;
  total: number;
  customer?: CustomerInfo;
  siteUrl?: string;
  upiId?: string;
}

export const DEFAULT_UPI_ID = "7000947033-1@okbizaxis";

/**
 * ASCII-only escape constants for emojis.
 * Prevents source-file re-encoding corruption, surrogate pair splitting,
 * and preserves exact UTF-16 code points.
 */
export const E = {
  wave:    "\u{1F44B}",
  order:   "\u{1F6D2}",
  item:    "\u{1F4E6}",
  savings: "\u{1F4B0}",
  ship:    "\u{1F69A}",
  total:   "\u{1F4B5}",
  user:    "\u{1F464}",
  phone:   "\u{1F4F1}",
  address: "\u{1F4CD}",
  upi:     "\u{1F4B3}",
  track:   "\u{1F517}",
  thanks:  "\u{1F64F}",
} as const;

function formatMoney(amount: number): string {
  return Number(amount || 0).toLocaleString("en-IN");
}

/**
 * Builds the plain-text WhatsApp order message using ASCII-safe template strings.
 * Never uses window.location.origin or localhost for URLs.
 * If siteUrl is omitted or contains localhost, the "Track order & pay" link is omitted.
 */
export function buildWhatsAppMessage({
  orderId = "TEMP",
  items,
  savings,
  shipping = "FREE",
  total,
  customer,
  siteUrl,
  upiId = DEFAULT_UPI_ID,
}: BuildWhatsAppMessageOptions): string {
  const formattedOrderId = orderId || "TEMP";

  const itemsSection = items
    .map((item) => {
      const name = item.product?.name ?? item.name ?? "Item";
      const price = item.product?.price ?? item.price ?? 0;
      const qty = item.quantity;
      const lineTotal = price * qty;
      return `${E.item} *${name}*\n    ${qty} \u00D7 \u20B9${formatMoney(price)} = \u20B9${formatMoney(lineTotal)}`;
    })
    .join("\n\n");

  const savingsLine =
    savings && savings > 0
      ? `${E.savings} Wholesale savings: \u20B9${formatMoney(savings)}\n`
      : "";

  let shippingText = "FREE";
  if (typeof shipping === "number") {
    shippingText = shipping > 0 ? `\u20B9${formatMoney(shipping)}` : "FREE";
  } else if (typeof shipping === "string" && shipping.trim()) {
    shippingText = shipping.trim();
  }

  const customerName = customer?.name?.trim() || "";
  const customerPhone = customer?.phone?.trim() || "";
  const customerAddress = customer?.address?.trim() || "";
  const paymentUpiId = (upiId || DEFAULT_UPI_ID).trim();

  const divider = "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501";

  const lines: string[] = [
    `Hello URT Wholesale ${E.wave}`,
    "I'd like to place an order:",
    "",
    `${E.order} *Order #${formattedOrderId}*`,
    divider,
    itemsSection,
    divider,
    `${savingsLine}${E.ship} Shipping: ${shippingText}\n${E.total} *Total: \u20B9${formatMoney(total)}*`,
    "",
    `${E.user} *Name:* ${customerName}`,
    `${E.phone} *Phone:* ${customerPhone}`,
    `${E.address} *Address:* ${customerAddress}`,
  ];

  if (paymentUpiId) {
    lines.push("", `${E.upi} *UPI ID for Payment:*`, paymentUpiId);
  }

  // Track order & pay link: only absolute URL from siteUrl (never localhost)
  const cleanSiteUrl = (siteUrl || "").trim().replace(/\/+$/, "");
  const isLocalhost =
    cleanSiteUrl.includes("localhost") || cleanSiteUrl.includes("127.0.0.1");

  if (cleanSiteUrl && !isLocalhost && formattedOrderId) {
    lines.push("", `${E.track} Track order & pay:`, `${cleanSiteUrl}/order/${formattedOrderId}`);
  }

  lines.push("", `Please confirm availability. Thank you! ${E.thanks}`);

  return lines.join("\n");
}
