import { describe, it, expect } from "vitest";
import {
  RETURN_TYPES,
  RETURN_STATUSES,
  RETURN_REASON_CODES,
  RETURN_REASON_LABELS,
  RETURN_STATUS_LABELS,
  CLAIM_STATUSES,
  CLAIM_TYPES,
  CLAIM_STATUS_LABELS,
  CLAIM_TYPE_LABELS,
  isValidReturnType,
  isValidReturnStatus,
  isValidReturnReasonCode,
  isValidClaimStatus,
  isValidClaimType,
} from "./types/return";

describe("Returns Domain Validation & Constants", () => {
  describe("RETURN_TYPES", () => {
    it("contains return, replacement, and refund", () => {
      expect(RETURN_TYPES).toContain("return");
      expect(RETURN_TYPES).toContain("replacement");
      expect(RETURN_TYPES).toContain("refund");
      expect(RETURN_TYPES.length).toBe(3);
    });

    it("validates return types correctly with isValidReturnType", () => {
      expect(isValidReturnType("return")).toBe(true);
      expect(isValidReturnType("replacement")).toBe(true);
      expect(isValidReturnType("refund")).toBe(true);
      expect(isValidReturnType("exchange")).toBe(false);
      expect(isValidReturnType("")).toBe(false);
      expect(isValidReturnType(123)).toBe(false);
      expect(isValidReturnType(null)).toBe(false);
    });
  });

  describe("RETURN_STATUSES", () => {
    it("contains all 11 required lifecycle statuses", () => {
      const required = [
        "requested",
        "approved",
        "rejected",
        "pickup_scheduled",
        "in_transit",
        "received",
        "qc_passed",
        "qc_failed",
        "refunded",
        "replacement_shipped",
        "closed",
      ];
      for (const st of required) {
        expect(RETURN_STATUSES).toContain(st);
      }
      expect(RETURN_STATUSES.length).toBe(11);
    });

    it("validates return statuses with isValidReturnStatus", () => {
      expect(isValidReturnStatus("requested")).toBe(true);
      expect(isValidReturnStatus("qc_passed")).toBe(true);
      expect(isValidReturnStatus("replacement_shipped")).toBe(true);
      expect(isValidReturnStatus("pending")).toBe(false);
      expect(isValidReturnStatus("delivered")).toBe(false);
      expect(isValidReturnStatus(null)).toBe(false);
    });

    it("has human readable labels for all statuses", () => {
      for (const st of RETURN_STATUSES) {
        expect(RETURN_STATUS_LABELS[st]).toBeDefined();
        expect(RETURN_STATUS_LABELS[st].length).toBeGreaterThan(0);
      }
    });
  });

  describe("RETURN_REASON_CODES", () => {
    it("contains all 6 standard reason codes", () => {
      const reasons = [
        "damaged",
        "defective",
        "wrong_item",
        "short_quantity",
        "quality_issue",
        "other",
      ];
      for (const r of reasons) {
        expect(RETURN_REASON_CODES).toContain(r);
      }
      expect(RETURN_REASON_CODES.length).toBe(6);
    });

    it("validates return reason codes with isValidReturnReasonCode", () => {
      expect(isValidReturnReasonCode("damaged")).toBe(true);
      expect(isValidReturnReasonCode("defective")).toBe(true);
      expect(isValidReturnReasonCode("wrong_item")).toBe(true);
      expect(isValidReturnReasonCode("short_quantity")).toBe(true);
      expect(isValidReturnReasonCode("quality_issue")).toBe(true);
      expect(isValidReturnReasonCode("other")).toBe(true);
      expect(isValidReturnReasonCode("fraud")).toBe(false);
      expect(isValidReturnReasonCode(undefined)).toBe(false);
    });

    it("has descriptive labels for all reasons", () => {
      for (const r of RETURN_REASON_CODES) {
        expect(RETURN_REASON_LABELS[r]).toBeDefined();
        expect(RETURN_REASON_LABELS[r].length).toBeGreaterThan(0);
      }
    });
  });

  describe("CLAIM_STATUSES & CLAIM_TYPES", () => {
    it("contains all 5 claim statuses", () => {
      expect(CLAIM_STATUSES).toEqual(["none", "pending", "approved", "rejected", "settled"]);
    });

    it("contains all 5 claim types", () => {
      expect(CLAIM_TYPES).toEqual([
        "courier",
        "supplier",
        "transit_damage",
        "customer_fraud",
        "other",
      ]);
    });

    it("validates claim statuses and types with type guards", () => {
      expect(isValidClaimStatus("none")).toBe(true);
      expect(isValidClaimStatus("pending")).toBe(true);
      expect(isValidClaimStatus("settled")).toBe(true);
      expect(isValidClaimStatus("invalid")).toBe(false);

      expect(isValidClaimType("courier")).toBe(true);
      expect(isValidClaimType("supplier")).toBe(true);
      expect(isValidClaimType("unknown")).toBe(false);
    });

    it("has human labels for all claim statuses and types", () => {
      for (const cs of CLAIM_STATUSES) {
        expect(CLAIM_STATUS_LABELS[cs]).toBeDefined();
      }
      for (const ct of CLAIM_TYPES) {
        expect(CLAIM_TYPE_LABELS[ct]).toBeDefined();
      }
    });
  });
});
