import { describe, it, expect } from "vitest";
import { validateReviewContent } from "./reviewAntiFake";

describe("Review Anti-Fake & Anti-Spam Suite", () => {
  it("approves genuine, well-structured wholesale review", () => {
    const res = validateReviewContent({
      rating: 5,
      authorName: "Sharma Telecommunication",
      title: "Excellent build quality and packaging",
      body: "High-grade tempered glass with zero bubbles. Sold out at our mobile counter in 2 days.",
    });

    expect(res.isValid).toBe(true);
    expect(res.error).toBeUndefined();
  });

  it("rejects non-integer and out-of-range star ratings", () => {
    expect(
      validateReviewContent({
        rating: 0,
        authorName: "Rajesh",
        body: "Very good quality cables.",
      }).isValid
    ).toBe(false);

    expect(
      validateReviewContent({
        rating: 6,
        authorName: "Rajesh",
        body: "Very good quality cables.",
      }).isValid
    ).toBe(false);

    expect(
      validateReviewContent({
        rating: 4.5,
        authorName: "Rajesh",
        body: "Very good quality cables.",
      }).isValid
    ).toBe(false);
  });

  it("rejects missing or single-character author names", () => {
    expect(
      validateReviewContent({
        rating: 5,
        authorName: "",
        body: "Solid construction and durable wiring.",
      }).isValid
    ).toBe(false);

    expect(
      validateReviewContent({
        rating: 5,
        authorName: "A",
        body: "Solid construction and durable wiring.",
      }).isValid
    ).toBe(false);
  });

  it("blocks URL spam in author name", () => {
    const res = validateReviewContent({
      rating: 5,
      authorName: "visit my site http://spam.com",
      body: "Great cables and good wholesale discount.",
    });

    expect(res.isValid).toBe(false);
    expect(res.error).toContain("Links and web addresses");
  });

  it("blocks body text under 10 characters (prevents fake low-effort spam)", () => {
    const res = validateReviewContent({
      rating: 5,
      authorName: "Anil Mobiles",
      body: "Good",
    });

    expect(res.isValid).toBe(false);
    expect(res.error).toContain("at least 10 characters");
  });

  it("blocks external links, URLs, telegram and whatsapp spam in review body", () => {
    const spamVariations = [
      "Check out our catalog at https://fakecheapsupplier.com for cheaper rates",
      "Contact me on wa.me/919999999999 for dealer rates",
      "Join our group t.me/freecoupons for extra discounts",
      "Visit www.mobilewholesalegurgaon.in for direct factory supply",
    ];

    for (const spam of spamVariations) {
      const res = validateReviewContent({
        rating: 5,
        authorName: "Rohan Telecom",
        body: spam,
      });

      expect(res.isValid).toBe(false);
      expect(res.error).toContain("External URLs, links, and promo codes are not allowed");
    }
  });

  it("blocks repetitive character spam", () => {
    const res = validateReviewContent({
      rating: 5,
      authorName: "Rohan Telecom",
      body: "Great quality aaaaaaaaaaaaaaaaaaaaaaaa",
    });

    expect(res.isValid).toBe(false);
    expect(res.error).toContain("repetitive character spam");
  });
});

