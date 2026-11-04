import { describe, it, expect } from "vitest";
import type { MarqueeAnnouncement, MarqueeAnnouncementInput } from "./index";

describe("Marquee Announcements Domain & Validation", () => {
  it("defines standard MarqueeAnnouncement shape with required fields", () => {
    const item: MarqueeAnnouncement = {
      id: "test-uuid-1",
      badge: "WHOLESALE TIERS",
      title: "UP TO 35% BULK SAVINGS",
      subtitle: "Automatic tier volume discounts on 100+ pcs",
      icon: "BadgePercent",
      link_url: "/marketplace",
      sort_order: 1,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    expect(item.id).toBe("test-uuid-1");
    expect(item.badge).toBe("WHOLESALE TIERS");
    expect(item.title).toBe("UP TO 35% BULK SAVINGS");
    expect(item.is_active).toBe(true);
    expect(item.sort_order).toBe(1);
    expect(item.icon).toBe("BadgePercent");
  });

  it("allows MarqueeAnnouncementInput to omit system-generated fields", () => {
    const input: MarqueeAnnouncementInput = {
      badge: "FREE DELIVERY",
      title: "₹0 SHIPPING ON ORDERS ₹999+",
      subtitle: "Pan-India express logistics across all states",
      icon: "Truck",
      link_url: "/marketplace",
      sort_order: 2,
      is_active: true,
    };

    expect(input.badge).toBe("FREE DELIVERY");
    expect(input.title).toBe("₹0 SHIPPING ON ORDERS ₹999+");
    expect(input.icon).toBe("Truck");
    expect(input.link_url).toBe("/marketplace");
  });

  it("handles empty or optional link_url gracefully", () => {
    const itemWithoutLink: MarqueeAnnouncement = {
      id: "test-uuid-2",
      badge: "100% QC",
      title: "VERIFIED WHOLESALE QUALITY",
      subtitle: "Dual inspection before dispatch",
      icon: "ShieldCheck",
      link_url: null,
      sort_order: 3,
      is_active: true,
    };

    expect(itemWithoutLink.link_url).toBeNull();
  });
});

