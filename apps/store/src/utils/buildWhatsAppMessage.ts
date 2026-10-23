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
  orderUrl?: string;
  upiId?: string;
}

export const DEFAULT_UPI_ID = "7000947033-2@ybl";

const NUMBER_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

function getItemNumberEmoji(index: number): string {
  if (index < NUMBER_EMOJIS.length) {
    return NUMBER_EMOJIS[index]!;
  }
  return `${index + 1}️⃣`;
}

function formatMoney(amount: number): string {
  return Number(amount || 0).toLocaleString("en-IN");
}

/**
 * Builds the plain-text WhatsApp order message with real newlines.
 * Never includes "%0A" - URL encoding must only be performed once when building the URL.
 */
export function buildWhatsAppMessage({
  orderId = "TEMP",
  items,
  savings,
  shipping = "FREE",
  total,
  customer,
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
    savings && savings > 0 ? `🏷️ Wholesale savings: ₹${formatMoney(savings)}\n` : "";

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

  const lines = [
    "Hello URT Wholesale 👋",
    "I'd like to place an order:",
    "",
    `🧾 *Order #${formattedOrderId}*`,
    "━━━━━━━━━━━━━━",
    itemsSection,
    "━━━━━━━━━━━━━━",
    `${savingsLine}🚚 Shipping: ${shippingText}\n💰 *Total: ₹${formatMoney(total)}*`,
    "",
    `👤 *Name:* ${customerName}`,
    `📞 *Phone:* ${customerPhone}`,
    `📍 *Address:* ${customerAddress}`,
  ];

  if (paymentUpiId) {
    lines.push("", "💳 *UPI ID for Payment:*", paymentUpiId);
  }

  lines.push("", "Please confirm availability. Thank you! 🙏");

  return lines.join("\n");
}
