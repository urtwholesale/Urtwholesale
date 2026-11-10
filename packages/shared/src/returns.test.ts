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
import {
  RETURN_EVIDENCE_URL_TTL_SECONDS,
  RETURN_EVIDENCE_BUCKET,
  getReturnEvidenceSignedUrl,
  type StorageSignedUrlClient,
} from "./returns";

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
    it("contains all 12 required lifecycle statuses", () => {
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
        "cancelled",
      ];
      for (const st of required) {
        expect(RETURN_STATUSES).toContain(st);
      }
      expect(RETURN_STATUSES.length).toBe(12);
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

  describe("Return Evidence Signed URL Helper (getReturnEvidenceSignedUrl)", () => {
    it("defines RETURN_EVIDENCE_URL_TTL_SECONDS as exactly 900 seconds (15 minutes)", () => {
      expect(RETURN_EVIDENCE_URL_TTL_SECONDS).toBe(900);
      expect(RETURN_EVIDENCE_BUCKET).toBe("return-evidence");
    });

    it("generates signed URL with default 900s TTL using private return-evidence bucket", async () => {
      let capturedBucket = "";
      let capturedPath = "";
      let capturedTtl = 0;

      const mockStorage: StorageSignedUrlClient = {
        from: (bucket: string) => {
          capturedBucket = bucket;
          return {
            createSignedUrl: async (path: string, expiresIn: number) => {
              capturedPath = path;
              capturedTtl = expiresIn;
              return { data: { signedUrl: `https://storage.example.com/${bucket}/${path}?token=abc` }, error: null };
            },
          };
        },
      };

      const result = await getReturnEvidenceSignedUrl(
        mockStorage,
        "user-123/returns/RET-001/evidence.webp"
      );

      expect(capturedBucket).toBe("return-evidence");
      expect(capturedPath).toBe("user-123/returns/RET-001/evidence.webp");
      expect(capturedTtl).toBe(900);
      expect(result).toBe("https://storage.example.com/return-evidence/user-123/returns/RET-001/evidence.webp?token=abc");
    });

    it("strictly caps requested TTL to 900 seconds when caller requests 3600 seconds", async () => {
      let capturedTtl = 0;

      const mockStorage: StorageSignedUrlClient = {
        from: () => ({
          createSignedUrl: async (_path: string, expiresIn: number) => {
            capturedTtl = expiresIn;
            return { data: { signedUrl: "https://signed.url" }, error: null };
          },
        }),
      };

      await getReturnEvidenceSignedUrl(mockStorage, "user-1/file.jpg", 3600);
      expect(capturedTtl).toBe(900);

      await getReturnEvidenceSignedUrl(mockStorage, "user-1/file.jpg", 86400);
      expect(capturedTtl).toBe(900);
    });

    it("allows shorter TTL if requested (e.g. 300 seconds) but clamps non-positive values to 1", async () => {
      let capturedTtl = 0;

      const mockStorage: StorageSignedUrlClient = {
        from: () => ({
          createSignedUrl: async (_path: string, expiresIn: number) => {
            capturedTtl = expiresIn;
            return { data: { signedUrl: "https://signed.url" }, error: null };
          },
        }),
      };

      await getReturnEvidenceSignedUrl(mockStorage, "user-1/file.jpg", 300);
      expect(capturedTtl).toBe(300);

      await getReturnEvidenceSignedUrl(mockStorage, "user-1/file.jpg", 0);
      expect(capturedTtl).toBe(1);

      await getReturnEvidenceSignedUrl(mockStorage, "user-1/file.jpg", -50);
      expect(capturedTtl).toBe(1);
    });

    it("returns pre-existing full URLs immediately without invoking storage signing", async () => {
      let called = false;
      const mockStorage: StorageSignedUrlClient = {
        from: () => {
          called = true;
          return {
            createSignedUrl: async () => ({ data: null, error: null }),
          };
        },
      };

      const httpUrl = "https://images.example.com/mock-evidence.png";
      const resHttp = await getReturnEvidenceSignedUrl(mockStorage, httpUrl);
      expect(resHttp).toBe(httpUrl);
      expect(called).toBe(false);

      const dataUrl = "data:image/png;base64,iVBORw0KGgo=";
      const resData = await getReturnEvidenceSignedUrl(mockStorage, dataUrl);
      expect(resData).toBe(dataUrl);
      expect(called).toBe(false);
    });

    it("returns empty string for empty or non-string paths without calling storage", async () => {
      let called = false;
      const mockStorage: StorageSignedUrlClient = {
        from: () => {
          called = true;
          return {
            createSignedUrl: async () => ({ data: null, error: null }),
          };
        },
      };

      expect(await getReturnEvidenceSignedUrl(mockStorage, "")).toBe("");
      expect(await getReturnEvidenceSignedUrl(mockStorage, "   ")).toBe("");
      expect(await getReturnEvidenceSignedUrl(mockStorage, null as any)).toBe("");
      expect(await getReturnEvidenceSignedUrl(mockStorage, undefined as any)).toBe("");
      expect(called).toBe(false);
    });

    it("handles storage API error gracefully and returns empty string", async () => {
      const mockStorage: StorageSignedUrlClient = {
        from: () => ({
          createSignedUrl: async () => ({
            data: null,
            error: { message: "Object not found in bucket", statusCode: 404 },
          }),
        }),
      };

      const res = await getReturnEvidenceSignedUrl(mockStorage, "missing.png");
      expect(res).toBe("");
    });

    it("handles thrown storage exception gracefully without crashing", async () => {
      const mockStorage: StorageSignedUrlClient = {
        from: () => ({
          createSignedUrl: async () => {
            throw new Error("Network timeout while contacting storage gateway");
          },
        }),
      };

      const res = await getReturnEvidenceSignedUrl(mockStorage, "timeout.png");
      expect(res).toBe("");
    });
  });
});
