import { describe, it, expect } from "vitest";
import { buildWhatsAppMessage, DEFAULT_UPI_ID } from "./buildWhatsAppMessage";

describe("buildWhatsAppMessage", () => {
  const sampleItems = [
    {
      name: "65W GaN Charger",
      price: 899,
      quantity: 2,
    },
    {
      name: "Type-C Braided Cable",
      price: 99,
      quantity: 10,
    },
  ];

  const sampleCustomer = {
    name: "Shubham Jain",
    phone: "7000947033",
    address: "3 Street Killai Naka Balakot Road, Damoh, MP",
  };

  it("includes UPI ID for payment, QR code link, and does NOT include View order & pay", () => {
    expect(DEFAULT_UPI_ID).toBe("7000947033-1@okbizaxis");
    const msg = buildWhatsAppMessage({
      orderId: "URT-261023-TEST",
      items: sampleItems,
      total: 2797,
      customer: sampleCustomer,
      qrCodeUrl: "https://urtwholesale.com/payment-qr.png",
    });

    expect(msg).toContain("💳 *UPI ID for Payment:*");
    expect(msg).toContain("7000947033-1@okbizaxis");
    expect(msg).toContain("📲 *Scan & Pay QR Code:*");
    expect(msg).toContain("https://urtwholesale.com/payment-qr.png");
    expect(msg).not.toContain("View order & pay");
    expect(msg).not.toContain("🔗");
  });

  it("uses custom upiId and custom qrCodeUrl if provided", () => {
    const msg = buildWhatsAppMessage({
      orderId: "URT-261023-TEST2",
      items: sampleItems,
      total: 2797,
      customer: sampleCustomer,
      upiId: "custom@upi",
      qrCodeUrl: "https://example.com/qr.png",
    });

    expect(msg).toContain("💳 *UPI ID for Payment:*");
    expect(msg).toContain("custom@upi");
    expect(msg).toContain("📲 *Scan & Pay QR Code:*");
    expect(msg).toContain("https://example.com/qr.png");
    expect(msg).not.toContain("View order & pay");
  });
});
