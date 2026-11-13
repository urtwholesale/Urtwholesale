import { describe, it, expect } from "vitest";
import { sanitizeSpreadsheetCell, sanitizeSpreadsheetRow } from "./csvSecurity";

describe("Spreadsheet / CSV Formula Injection Sanitization (CWE-1236)", () => {
  it("prepends a single quote to formulas starting with '='", () => {
    expect(sanitizeSpreadsheetCell('=HYPERLINK("http://evil.com", "click")')).toBe(
      '\'=HYPERLINK("http://evil.com", "click")'
    );
    expect(sanitizeSpreadsheetCell("=1+1")).toBe("'=1+1");
  });

  it("prepends a single quote to formula triggers '+', '-', and '@'", () => {
    expect(sanitizeSpreadsheetCell("+cmd|' /C calc'!A0")).toBe("'+cmd|' /C calc'!A0");
    expect(sanitizeSpreadsheetCell("-5+5")).toBe("'-5+5");
    expect(sanitizeSpreadsheetCell("@SUM(A1:A10)")).toBe("'@SUM(A1:A10)");
  });

  it("handles leading whitespace before formula trigger characters", () => {
    expect(sanitizeSpreadsheetCell("   =2+2")).toBe("'   =2+2");
  });

  it("leaves standard safe strings untouched", () => {
    expect(sanitizeSpreadsheetCell("John Doe")).toBe("John Doe");
    expect(sanitizeSpreadsheetCell("URT-CAT-001")).toBe("URT-CAT-001");
    expect(sanitizeSpreadsheetCell("₹450.00")).toBe("₹450.00");
    expect(sanitizeSpreadsheetCell("123 Main St, Jaipur")).toBe("123 Main St, Jaipur");
  });

  it("preserves non-string primitive values", () => {
    expect(sanitizeSpreadsheetCell(100)).toBe(100);
    expect(sanitizeSpreadsheetCell(0)).toBe(0);
    expect(sanitizeSpreadsheetCell(true)).toBe(true);
    expect(sanitizeSpreadsheetCell(false)).toBe(false);
    expect(sanitizeSpreadsheetCell(null)).toBe(null);
    expect(sanitizeSpreadsheetCell(undefined)).toBe(undefined);
  });

  it("sanitizes arrays of row cells", () => {
    const rawRow = ["=1+1", "Safe Name", 50, "@DDE"];
    const sanitized = sanitizeSpreadsheetRow(rawRow);
    expect(sanitized).toEqual(["'=1+1", "Safe Name", 50, "'@DDE"]);
  });

  it("sanitizes key-value record rows", () => {
    const rawRecord = {
      name: '=HYPERLINK("http://attacker.com")',
      sku: "URT-001",
      quantity: 10,
      note: "+malicious_note",
    };
    const sanitized = sanitizeSpreadsheetRow(rawRecord);
    expect(sanitized).toEqual({
      name: '\'=HYPERLINK("http://attacker.com")',
      sku: "URT-001",
      quantity: 10,
      note: "'+malicious_note",
    });
  });
});
