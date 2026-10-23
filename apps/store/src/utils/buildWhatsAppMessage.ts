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

const NUMBER_EMOJIS = [
  "1\u{FE0F}\u{20E3}",
  "2\u{FE0F}\u{20E3}",
  "3\u{FE0F}\u{20E3}",
  "4\u{FE0F}\u{20E3}",
  "5\u{FE0F}\u{20E3}",
  "6\u{FE0F}\u{20E3}",
  "7\u{FE0F}\u{20E3}",
  "8\u{FE0F}\u{20E3}",
  "9\u{FE0F}\u{20E3}",
  "10\u{FE0F}\u{20E3}",
];

function getItemNumberEmoji(index: number): string {
  if (index < NUMBER_EMOJIS.length) {
    return NUMBER_EMOJIS[index]!;
  }
  return `${index + 1}\u{FE0F}\u{20E3}`;
}

function formatMoney(amount: number): string {
  return Number(amount || 0).toLocaleString("en-IN");
}

/**
 * Builds the plain-text WhatsApp order message with real newlines.
 * Emojis are defined via explicit Unicode code-point escapes (\u{...}) to prevent
 * surrogate pair corruption or encoding issues ( / U+FFFD).
 *
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
    .map((item, index) => {
      const name = item.product?.name ?? item.name ?? "Item";
      const price = item.product?.price ?? item.price ?? 0;
      const qty = item.quantity;
      const lineTotal = price * qty;
      const emoji = getItemNumberEmoji(index);
      return `${emoji} *${name}*\n    ${qty} × ₹${formatMoney(price)} = ₹${formatMoney(lineTotal)}`;
    })
    .join("\n\n");

  const savingsLine =
    savings && savings > 0 ? `\u{1F3F7}\u{FE0F} Wholesale savings: ₹${formatMoney(savings)}\n` : "";

  let shippingText = "FREE";
  if (typeof shipping === "number") {
    shippingText = shipping > 0 ? `₹${formatMoney(shipping)}` : "FREE";
  } else if (typeof shipping === "string" && shipping.trim()) {
    shippingText = shipping.trim();
  }

  const customerName = customer?.name?.trim() || "";
  const customerPhone = customer?.phone?.trim() || "";
  const customerAddress = customer?.address?.trim() || "";
  const paymentUpiId = (upiId || DEFAULT_UPI_ID).trim();

  const lines: string[] = [
    `Hello URT Wholesale \u{1F44B}`,
    "I'd like to place an order:",
    "",
    `\u{1F9FE} *Order #${formattedOrderId}*`,
    "━━━━━━━━━━━━━━",
    itemsSection,
    "━━━━━━━━━━━━━━",
    `${savingsLine}\u{1F69A} Shipping: ${shippingText}\n\u{1F4B0} *Total: ₹${formatMoney(total)}*`,
    "",
    `\u{1F464} *Name:* ${customerName}`,
    `\u{1F4DE} *Phone:* ${customerPhone}`,
    `\u{1F4CD} *Address:* ${customerAddress}`,
  ];

  if (paymentUpiId) {
    lines.push("", `\u{1F4B3} *UPI ID for Payment:*`, paymentUpiId);
  }

  // Track order & pay link: only absolute URL from siteUrl (never localhost)
  const cleanSiteUrl = (siteUrl || "").trim().replace(/\/+$/, "");
  const isLocalhost =
    cleanSiteUrl.includes("localhost") || cleanSiteUrl.includes("127.0.0.1");

  if (cleanSiteUrl && !isLocalhost && formattedOrderId) {
    lines.push("", `\u{1F517} Track order & pay:`, `${cleanSiteUrl}/order/${formattedOrderId}`);
  }

  lines.push("", `Please confirm availability. Thank you! \u{1F64F}`);

  return lines.join("\n");
}
