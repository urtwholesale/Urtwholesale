import { describe, it, expect } from "vitest";
import { verifyAdminAuthorization } from "./adminAuth";

describe("verifyAdminAuthorization (is_admin MFA enforcement)", () => {
  const adminId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
  const customerId = "c1c2c3c4-c5c6-7890-abcd-ef1234567890";

  describe("When MFA enforcement is active (enforceAdminMfa = true)", () => {
    it("denies an admin with aal1 session", () => {
      const result = verifyAdminAuthorization({
        userId: adminId,
        role: "admin",
        aal: "aal1",
        enforceAdminMfa: true,
      });
      expect(result).toBe(false);
    });

    it("denies an admin with missing or undefined aal", () => {
      const resultMissing = verifyAdminAuthorization({
        userId: adminId,
        role: "admin",
        aal: null,
        enforceAdminMfa: true,
      });
      expect(resultMissing).toBe(false);

      const resultUndefined = verifyAdminAuthorization({
        userId: adminId,
        role: "admin",
        enforceAdminMfa: true,
      });
      expect(resultUndefined).toBe(false);
    });

    it("allows an admin with aal2 session", () => {
      const result = verifyAdminAuthorization({
        userId: adminId,
        role: "admin",
        aal: "aal2",
        enforceAdminMfa: true,
      });
      expect(result).toBe(true);
    });

    it("strictly denies a non-admin (customer) even with aal2", () => {
      const result = verifyAdminAuthorization({
        userId: customerId,
        role: "customer",
        aal: "aal2",
        enforceAdminMfa: true,
      });
      expect(result).toBe(false);
    });

    it("strictly denies a non-admin (customer) with aal1", () => {
      const result = verifyAdminAuthorization({
        userId: customerId,
        role: "customer",
        aal: "aal1",
        enforceAdminMfa: true,
      });
      expect(result).toBe(false);
    });

    it("strictly denies an unauthenticated user (null/undefined userId)", () => {
      expect(
        verifyAdminAuthorization({
          userId: null,
          role: "admin",
          aal: "aal2",
          enforceAdminMfa: true,
        })
      ).toBe(false);

      expect(
        verifyAdminAuthorization({
          userId: undefined,
          role: "admin",
          aal: "aal2",
          enforceAdminMfa: true,
        })
      ).toBe(false);
    });
  });

  describe("When MFA enforcement is inactive (enforceAdminMfa = false / safe rollout)", () => {
    it("allows an admin with aal1 session", () => {
      const result = verifyAdminAuthorization({
        userId: adminId,
        role: "admin",
        aal: "aal1",
        enforceAdminMfa: false,
      });
      expect(result).toBe(true);
    });

    it("allows an admin with aal2 session", () => {
      const result = verifyAdminAuthorization({
        userId: adminId,
        role: "admin",
        aal: "aal2",
        enforceAdminMfa: false,
      });
      expect(result).toBe(true);
    });

    it("allows an admin with no aal claim during safe rollout", () => {
      const result = verifyAdminAuthorization({
        userId: adminId,
        role: "admin",
        aal: null,
        enforceAdminMfa: false,
      });
      expect(result).toBe(true);
    });

    it("strictly denies non-admins even when enforcement is off", () => {
      expect(
        verifyAdminAuthorization({
          userId: customerId,
          role: "customer",
          aal: "aal1",
          enforceAdminMfa: false,
        })
      ).toBe(false);

      expect(
        verifyAdminAuthorization({
          userId: customerId,
          role: "customer",
          aal: "aal2",
          enforceAdminMfa: false,
        })
      ).toBe(false);
    });

    it("strictly denies anonymous / unauthenticated callers", () => {
      expect(
        verifyAdminAuthorization({
          userId: null,
          role: null,
          aal: null,
          enforceAdminMfa: false,
        })
      ).toBe(false);
    });
  });

  describe("Edge cases and role validation", () => {
    it("denies arbitrary or invalid roles under both enforcement states", () => {
      const invalidRoles = ["manager", "moderator", "superadmin", "", "ADMIN", "guest"];
      for (const badRole of invalidRoles) {
        expect(
          verifyAdminAuthorization({
            userId: adminId,
            role: badRole,
            aal: "aal2",
            enforceAdminMfa: true,
          })
        ).toBe(false);

        expect(
          verifyAdminAuthorization({
            userId: adminId,
            role: badRole,
            aal: "aal1",
            enforceAdminMfa: false,
          })
        ).toBe(false);
      }
    });
  });
});

