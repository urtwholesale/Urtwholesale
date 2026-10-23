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

  it("encodes and decodes with zero replacement characters (U+FFFD / )", () => {
    const rawMessage = buildWhatsAppMessage({
      orderId: "URT-261023-SAMPLE",
      items: sampleItems,
      total: 2797,
      customer: sampleCustomer,
      siteUrl: "https://urtwholesale.com",
      upiId: "7000947033-1@okbizaxis",
    });

    // Verify raw message contains valid emoji characters
    expect(rawMessage).toContain("\u{1F44B}"); // 👋
    expect(rawMessage).toContain("\u{1F9FE}"); // 🧾
    expect(rawMessage).toContain("\u{1F69A}"); // 🚚
    expect(rawMessage).toContain("\u{1F4B0}"); // 💰
    expect(rawMessage).toContain("\u{1F4B3}"); // 💳
    expect(rawMessage).toContain("\u{1F517}"); // 🔗
    expect(rawMessage).toContain("\u{1F64F}"); // 🙏

    // Encode as URL parameter exactly as https://wa.me/?text= does
    const encoded = encodeURIComponent(rawMessage);
    const decoded = decodeURIComponent(encoded);

    // CRITICAL: Ensure no U+FFFD replacement character occurs
    expect(decoded).not.toContain("\uFFFD");
    expect(decoded).toBe(rawMessage);
  });

  it("includes 'Track order & pay' with absolute siteUrl and plain text UPI ID", () => {
    const msg = buildWhatsAppMessage({
      orderId: "URT-261023-TEST",
      items: sampleItems,
      total: 2797,
      customer: sampleCustomer,
      siteUrl: "https://urtwholesale.com",
      upiId: "7000947033-1@okbizaxis",
    });

    expect(msg).toContain("Track order & pay:\nhttps://urtwholesale.com/order/URT-261023-TEST");
    expect(msg).toContain("*UPI ID for Payment:*\n7000947033-1@okbizaxis");
    // Direct image link should be removed
    expect(msg).not.toContain("payment-qr.png");
    expect(msg).not.toContain("Scan & Pay QR Code");
  });

  it("omits 'Track order & pay' if siteUrl is omitted or is localhost", () => {
    const msgNoSite = buildWhatsAppMessage({
      orderId: "URT-261023-TEST",
      items: sampleItems,
      total: 2797,
      customer: sampleCustomer,
      siteUrl: "",
    });

    expect(msgNoSite).not.toContain("Track order & pay");
    expect(msgNoSite).not.toContain("localhost");

    const msgLocalhost = buildWhatsAppMessage({
      orderId: "URT-261023-TEST",
      items: sampleItems,
      total: 2797,
      customer: sampleCustomer,
      siteUrl: "http://localhost:5173",
    });

    expect(msgLocalhost).not.toContain("Track order & pay");
    expect(msgLocalhost).not.toContain("localhost");
  });

  it("uses custom upiId and respects DEFAULT_UPI_ID fallback", () => {
    expect(DEFAULT_UPI_ID).toBe("7000947033-1@okbizaxis");

    const msgCustom = buildWhatsAppMessage({
      orderId: "URT-261023-CUSTOM",
      items: sampleItems,
      total: 2797,
      customer: sampleCustomer,
      upiId: "merchant@bank",
    });

    expect(msgCustom).toContain("*UPI ID for Payment:*\nmerchant@bank");
  });
});
