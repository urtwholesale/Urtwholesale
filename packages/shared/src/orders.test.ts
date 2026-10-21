import { describe, it, expect } from "vitest";
import {
  matchesOrderTab,
  filterOrders,
  calculateCustomerLifetimeStats,
  generatePackingSlipHtml,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_BADGES,
} from "./orders";
import type { Order } from "./types/order";

const sampleOrders: Order[] = [
  {
    id: "URT-261021-0001",
    user_id: "user-1",
    customer: {
      name: "Rajesh Kumar",
      phone: "9876543210",
      business_name: "Rajesh Mobile Hub",
      address: "Shop 12, Main Market, Mumbai",
      pincode: "400001",
    },
    items: [
      {
        product_id: "prod-1",
        name: "Fast Charging 65W GaN Adapter",
        sku: "URT-CHG-65W",
        price: 499,
        quantity: 20,
      },
    ],
    total: 9980,
    status: "pending",
    source: "website",
    payment_status: "paid",
    created_at: new Date(Date.now() - 36 * 3600 * 1000).toISOString(), // 36 hours ago
  },
  {
    id: "URT-261021-0002",
    user_id: "user-1",
    customer: {
      name: "Rajesh Kumar",
      phone: "9876543210",
      business_name: "Rajesh Mobile Hub",
      address: "Shop 12, Main Market, Mumbai",
      pincode: "400001",
    },
    items: [
      {
        product_id: "prod-2",
        name: "Braided Type-C Cable 1.5m",
        sku: "URT-CBL-TYPC",
        price: 89,
        quantity: 50,
      },
    ],
    total: 4450,
    status: "confirmed",
    source: "whatsapp",
    payment_status: "cod",
    created_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
  },
  {
    id: "URT-261021-0003",
    user_id: "user-2",
    customer: {
      name: "Sunil Verma",
      phone: "9123456789",
      address: "Warehouse 4, Electronic Zone, Pune",
      pincode: "411001",
    },
    items: [
      {
        product_id: "prod-3",
        name: "TWS Earbuds Pro ANC",
        sku: "URT-TWS-ANC",
        price: 899,
        quantity: 10,
      },
    ],
    total: 8990,
    status: "on_hold",
    source: "website",
    payment_status: "pending",
    created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  },
  {
    id: "URT-261021-0004",
    user_id: "user-1",
    customer: {
      name: "Rajesh Kumar",
      phone: "9876543210",
      business_name: "Rajesh Mobile Hub",
      address: "Shop 12, Main Market, Mumbai",
      pincode: "400001",
    },
    items: [],
    total: 3000,
    status: "cancelled",
    source: "website",
    payment_status: "refunded",
    created_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
  },
];

describe("matchesOrderTab", () => {
  it("matches pending tab", () => {
    expect(matchesOrderTab(sampleOrders[0]!, "pending")).toBe(true);
    expect(matchesOrderTab(sampleOrders[1]!, "pending")).toBe(false);
  });

  it("matches ready_to_ship tab for both confirmed and processing", () => {
    expect(matchesOrderTab(sampleOrders[1]!, "ready_to_ship")).toBe(true);
    expect(matchesOrderTab({ ...sampleOrders[1]!, status: "processing" }, "ready_to_ship")).toBe(true);
    expect(matchesOrderTab(sampleOrders[0]!, "ready_to_ship")).toBe(false);
  });

  it("matches on_hold tab", () => {
    expect(matchesOrderTab(sampleOrders[2]!, "on_hold")).toBe(true);
    expect(matchesOrderTab(sampleOrders[0]!, "on_hold")).toBe(false);
  });

  it("matches cancelled tab for cancelled and refunded", () => {
    expect(matchesOrderTab(sampleOrders[3]!, "cancelled")).toBe(true);
    expect(matchesOrderTab({ ...sampleOrders[3]!, status: "refunded" }, "cancelled")).toBe(true);
  });

  it("matches all tab unconditionally", () => {
    expect(matchesOrderTab(sampleOrders[0]!, "all")).toBe(true);
    expect(matchesOrderTab(sampleOrders[2]!, "all")).toBe(true);
  });
});

describe("filterOrders", () => {
  it("filters by source", () => {
    const whatsappOnly = filterOrders(sampleOrders, { source: "whatsapp" });
    expect(whatsappOnly).toHaveLength(1);
    expect(whatsappOnly[0]?.id).toBe("URT-261021-0002");
  });

  it("filters by payment status", () => {
    const paidOnly = filterOrders(sampleOrders, { paymentStatus: "paid" });
    expect(paidOnly).toHaveLength(1);
    expect(paidOnly[0]?.id).toBe("URT-261021-0001");
  });

  it("filters by search SKU", () => {
    const matchSku = filterOrders(sampleOrders, { search: "URT-CHG-65W" });
    expect(matchSku).toHaveLength(1);
    expect(matchSku[0]?.id).toBe("URT-261021-0001");
  });

  it("filters by customer name or business name", () => {
    const matchName = filterOrders(sampleOrders, { search: "Sunil" });
    expect(matchName).toHaveLength(1);
    expect(matchName[0]?.id).toBe("URT-261021-0003");

    const matchBiz = filterOrders(sampleOrders, { search: "Rajesh Mobile Hub" });
    expect(matchBiz).toHaveLength(3);
  });
});

describe("calculateCustomerLifetimeStats", () => {
  it("calculates total orders and spend excluding cancelled", () => {
    const stats = calculateCustomerLifetimeStats(sampleOrders, "9876543210");
    // Rajesh has 3 orders: 9980 (pending), 4450 (confirmed), 3000 (cancelled)
    expect(stats.total_orders).toBe(3);
    // total spend excludes cancelled: 9980 + 4450 = 14430
    expect(stats.total_spend).toBe(14430);
  });

  it("returns zero stats for non-matching customer", () => {
    const stats = calculateCustomerLifetimeStats(sampleOrders, "9999999999");
    expect(stats.total_orders).toBe(0);
    expect(stats.total_spend).toBe(0);
  });
});

describe("generatePackingSlipHtml", () => {
  it("includes order id, customer name, items, and packing checklist", () => {
    const html = generatePackingSlipHtml(sampleOrders[0]!);
    expect(html).toContain("URT-261021-0001");
    expect(html).toContain("Rajesh Kumar");
    expect(html).toContain("Fast Charging 65W GaN Adapter");
    expect(html).toContain("20 pcs");
    expect(html).toContain("WAREHOUSE PACKING SLIP");
  });
});
