import { describe, it, expect } from "vitest";
import { sanitizeSpreadsheetCell, sanitizeSpreadsheetRow } from "./csvSecurity";

describe("Spreadsheet / CSV Formula Injection Sanitization (CWE-1236)", () => {
  it("escapes '=' formula prefix individually", () => {
    expect(sanitizeSpreadsheetCell('=HYPERLINK("http://evil.com", "click")')).toBe(
      '\'=HYPERLINK("http://evil.com", "click")'
    );
    expect(sanitizeSpreadsheetCell("=1+1")).toBe("'=1+1");
    expect(sanitizeSpreadsheetCell("=cmd|' /C calc'!A0")).toBe("'=cmd|' /C calc'!A0");
  });

  it("escapes '+' formula prefix individually", () => {
    expect(sanitizeSpreadsheetCell("+cmd|' /C calc'!A0")).toBe("'+cmd|' /C calc'!A0");
    expect(sanitizeSpreadsheetCell("+12345")).toBe("'+12345");
  });

  it("escapes '-' formula prefix individually", () => {
    expect(sanitizeSpreadsheetCell("-5+5")).toBe("'-5+5");
    expect(sanitizeSpreadsheetCell("-cmd|' /C calc'!A0")).toBe("'-cmd|' /C calc'!A0");
  });

  it("escapes '@' formula prefix individually", () => {
    expect(sanitizeSpreadsheetCell("@SUM(A1:A10)")).toBe("'@SUM(A1:A10)");
    expect(sanitizeSpreadsheetCell("@evil.com")).toBe("'@evil.com");
  });

  it("escapes '\\t' (tab) prefix individually", () => {
    expect(sanitizeSpreadsheetCell("\t=1+1")).toBe("'\t=1+1");
    expect(sanitizeSpreadsheetCell("\tmalicious")).toBe("'\tmalicious");
  });

  it("escapes '\\r' (carriage return) prefix individually", () => {
    expect(sanitizeSpreadsheetCell("\r=1+1")).toBe("'\r=1+1");
    expect(sanitizeSpreadsheetCell("\rpayload")).toBe("'\rpayload");
  });

  it("handles leading whitespace before formula trigger characters", () => {
    expect(sanitizeSpreadsheetCell("   =2+2")).toBe("'   =2+2");
    expect(sanitizeSpreadsheetCell("  +calc")).toBe("'  +calc");
    expect(sanitizeSpreadsheetCell("  -100")).toBe("'  -100");
    expect(sanitizeSpreadsheetCell("  @sum")).toBe("'  @sum");
  });

  it("leaves standard safe strings untouched (does not match @ to | ASCII range)", () => {
    expect(sanitizeSpreadsheetCell("John Doe")).toBe("John Doe");
    expect(sanitizeSpreadsheetCell("URT-CAT-001")).toBe("URT-CAT-001");
    expect(sanitizeSpreadsheetCell("₹450.00")).toBe("₹450.00");
    expect(sanitizeSpreadsheetCell("123 Main St, Jaipur")).toBe("123 Main St, Jaipur");
    // Verify letters that fall between '@' (64) and '|' (124) are not escaped
    expect(sanitizeSpreadsheetCell("Apple")).toBe("Apple");
    expect(sanitizeSpreadsheetCell("Zebra")).toBe("Zebra");
    expect(sanitizeSpreadsheetCell("banana")).toBe("banana");
    expect(sanitizeSpreadsheetCell("zebra")).toBe("zebra");
    expect(sanitizeSpreadsheetCell("[Bracketed]")).toBe("[Bracketed]");
    expect(sanitizeSpreadsheetCell("_underscore")).toBe("_underscore");
    expect(sanitizeSpreadsheetCell("|pipe_start")).toBe("|pipe_start");
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
    const rawRow = ["=1+1", "Safe Name", 50, "@DDE", "+cmd"];
    const sanitized = sanitizeSpreadsheetRow(rawRow);
    expect(sanitized).toEqual(["'=1+1", "Safe Name", 50, "'@DDE", "'+cmd"]);
  });

  it("sanitizes key-value record rows", () => {
    const rawRecord = {
      name: '=HYPERLINK("http://attacker.com")',
      sku: "URT-001",
      quantity: 10,
      note: "+malicious_note",
      custom: "-subtraction",
    };
    const sanitized = sanitizeSpreadsheetRow(rawRecord);
    expect(sanitized).toEqual({
      name: '\'=HYPERLINK("http://attacker.com")',
      sku: "URT-001",
      quantity: 10,
      note: "'+malicious_note",
      custom: "'-subtraction",
    });
  });
});
