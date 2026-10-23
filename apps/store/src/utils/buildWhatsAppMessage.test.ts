import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { buildWhatsAppMessage, DEFAULT_UPI_ID, E } from "./buildWhatsAppMessage";

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

  it("asserts the generated message contains none of \\uFFFD and all expected code points", () => {
    const rawMessage = buildWhatsAppMessage({
      orderId: "URT-261023-SAMPLE",
      items: sampleItems,
      subtotal: 2790,
      savings: 200,
      shipping: "FREE",
      total: 2590,
      customer: sampleCustomer,
      siteUrl: "https://urtwholesale.com",
      upiId: "7000947033-1@okbizaxis",
    });

    // 1. Assert the generated message contains none of "\uFFFD"
    expect(rawMessage).not.toContain("\uFFFD");
    expect(rawMessage.includes("\uFFFD")).toBe(false);

    // 2. Assert it contains each expected code point
    expect(rawMessage).toContain(E.wave);    // \u{1F44B}
    expect(rawMessage).toContain(E.order);   // \u{1F6D2}
    expect(rawMessage).toContain(E.item);    // \u{1F4E6}
    expect(rawMessage).toContain(E.savings); // \u{1F4B0}
    expect(rawMessage).toContain(E.ship);    // \u{1F69A}
    expect(rawMessage).toContain(E.total);   // \u{1F4B5}
    expect(rawMessage).toContain(E.user);    // \u{1F464}
    expect(rawMessage).toContain(E.phone);   // \u{1F4F1}
    expect(rawMessage).toContain(E.address); // \u{1F4CD}
    expect(rawMessage).toContain(E.upi);     // \u{1F4B3}
    expect(rawMessage).toContain(E.track);   // \u{1F517}
    expect(rawMessage).toContain(E.thanks);  // \u{1F64F}

    // Explicit code point assertions
    expect(rawMessage).toContain("\u{1F44B}");
    expect(rawMessage).toContain("\u{1F6D2}");
    expect(rawMessage).toContain("\u{1F4E6}");
    expect(rawMessage).toContain("\u{1F4B0}");
    expect(rawMessage).toContain("\u{1F69A}");
    expect(rawMessage).toContain("\u{1F4B5}");
    expect(rawMessage).toContain("\u{1F464}");
    expect(rawMessage).toContain("\u{1F4F1}");
    expect(rawMessage).toContain("\u{1F4CD}");
    expect(rawMessage).toContain("\u{1F4B3}");
    expect(rawMessage).toContain("\u{1F517}");
    expect(rawMessage).toContain("\u{1F64F}");

    // 3. Assert decodeURIComponent(encodeURIComponent(message)) === message
    const encoded = encodeURIComponent(rawMessage);
    const decoded = decodeURIComponent(encoded);
    expect(decoded).toBe(rawMessage);
    expect(decoded).not.toContain("\uFFFD");
  });

  it("reads the generator source file as text and asserts it contains no \\uFFFD", () => {
    // 4. Guard against re-corruption: check the source file itself
    const sourcePath = path.resolve(__dirname, "buildWhatsAppMessage.ts");
    const sourceContent = fs.readFileSync(sourcePath, "utf-8");

    expect(sourceContent).not.toContain("\uFFFD");
    expect(sourceContent.includes("\uFFFD")).toBe(false);

    // Verify source file contains only ASCII characters (code <= 127)
    for (let i = 0; i < sourceContent.length; i++) {
      expect(sourceContent.charCodeAt(i)).toBeLessThanOrEqual(127);
    }
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
