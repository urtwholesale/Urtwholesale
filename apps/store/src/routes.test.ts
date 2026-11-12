import { describe, it, expect } from "vitest";
import { matchPath } from "react-router";

describe("Storefront Deep Link Route Matching (React Router 7)", () => {
  it("matches /order/:orderId and extracts orderId with token query param", () => {
    const match = matchPath({ path: "/order/:orderId" }, "/order/ORD-998877");
    expect(match).not.toBeNull();
    expect(match?.params.orderId).toBe("ORD-998877");

    const url = new URL("https://urtwholesale.com/order/ORD-998877?t=tok_abc123");
    expect(url.pathname).toBe("/order/ORD-998877");
    expect(url.searchParams.get("t")).toBe("tok_abc123");
  });

  it("matches /marketplace and preserves category query param", () => {
    const match = matchPath({ path: "/marketplace" }, "/marketplace");
    expect(match).not.toBeNull();

    const url = new URL("https://urtwholesale.com/marketplace?category=chargers");
    expect(url.searchParams.get("category")).toBe("chargers");
  });

  it("matches /dealers and /dealer-program deep links", () => {
    expect(matchPath({ path: "/dealers" }, "/dealers")).not.toBeNull();
    expect(matchPath({ path: "/dealership" }, "/dealership")).not.toBeNull();
    expect(matchPath({ path: "/dealer-program" }, "/dealer-program")).not.toBeNull();
  });
});
