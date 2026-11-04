import { describe, it, expect } from "vitest";
import type {
  DealershipTierMargin,
  DealershipItemShowcase,
  DealershipBenefitComparison,
  DealershipArticle,
} from "./index";

describe("Dealership Program Domain & Differentiation Models", () => {
  it("validates DealershipTierMargin shape with branded and copy differentiation", () => {
    const brandedItem: DealershipTierMargin = {
      id: "margin-1",
      item_type: "branded",
      category: "Fast Chargers",
      item_name: "Urbanrat 65W GaN Pro Dual-Port Charger",
      lot_size: "20 pcs / carton",
      cost_price: 285.0,
      retail_price_range: "₹699 – ₹799",
      margin_percentage: "+145% to +180%",
      profit_per_lot: "₹8,280 – ₹10,280",
      badge_text: "BRANDED ORIGINAL",
      sort_order: 1,
      is_active: true,
    };

    expect(brandedItem.item_type).toBe("branded");
    expect(brandedItem.cost_price).toBe(285.0);
    expect(brandedItem.is_active).toBe(true);

    const copyItem: DealershipTierMargin = {
      id: "margin-2",
      item_type: "copy",
      category: "Tempered Glass",
      item_name: "9H Sapphire Diamond Glass (Bulk)",
      lot_size: "50 pcs / box",
      cost_price: 18.0,
      retail_price_range: "₹99 – ₹149",
      margin_percentage: "+450% to +720%",
      profit_per_lot: "₹4,050 – ₹6,550",
      badge_text: "FAST TURNOVER COPY",
      sort_order: 2,
      is_active: true,
    };

    expect(copyItem.item_type).toBe("copy");
    expect(copyItem.cost_price).toBe(18.0);
  });

  it("validates DealershipItemShowcase shape with image and visual features", () => {
    const showcase: DealershipItemShowcase = {
      id: "showcase-1",
      item_type: "branded",
      title: "Urbanrat 65W GaN Pro (Branded)",
      image_url: "/hero/dark/offer-gan-65w.jpg",
      packaging_type: "Metallic embossed box with QR seal",
      warranty_type: "1-Year Instant 1-for-1 DOA Replacement",
      quality_grade: "Tier-1 GaN III Architecture",
      dealer_margin: "145% – 180% Gross Profit",
      features: ["BIS Certified", "Active Thermal Throttling"],
      sort_order: 1,
      is_active: true,
    };

    expect(showcase.image_url).toBe("/hero/dark/offer-gan-65w.jpg");
    expect(showcase.features).toHaveLength(2);
  });

  it("validates DealershipBenefitComparison shape between dealer and normal person", () => {
    const comparison: DealershipBenefitComparison = {
      id: "comp-1",
      feature_name: "Purchase Price Tier",
      normal_person_benefit: "Standard Retail MRP prices",
      urt_dealer_benefit: "Unfiltered Tier-1 Factory Direct Wholesale Depot Pricing",
      category: "Commercial",
      sort_order: 1,
      is_active: true,
    };

    expect(comparison.feature_name).toBe("Purchase Price Tier");
    expect(comparison.normal_person_benefit).toContain("Standard Retail MRP");
    expect(comparison.urt_dealer_benefit).toContain("Factory Direct Wholesale");
  });

  it("validates DealershipArticle shape for branded and copy paths", () => {
    const article: DealershipArticle = {
      id: "art-1",
      article_type: "branded",
      title: "URT Original Branded Gear Dealership",
      short_summary: "High ticket size, repeat brand loyalty, certified safety.",
      content: "Full detailed article content here...",
      badge: "PREMIUM AUTHENTIC",
      key_points: ["Official Urbanrat laser branding", "1-Year instant swap"],
      sort_order: 1,
      is_active: true,
    };

    expect(article.article_type).toBe("branded");
    expect(article.key_points).toHaveLength(2);
  });
});

