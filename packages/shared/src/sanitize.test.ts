import { describe, it, expect } from "vitest";
import { escapeHtml, getSafeRedirectUrl, sanitizeText, validateHoneypot } from "./sanitize";

describe("HTML Sanitization (escapeHtml)", () => {
  it("escapes all HTML special characters", () => {
    expect(escapeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;"
    );
    expect(escapeHtml('Hello & "World"')).toBe("Hello &amp; &quot;World&quot;");
    expect(escapeHtml("Tom & Jerry's Ice-Cream <5>")).toBe(
      "Tom &amp; Jerry&#39;s Ice-Cream &lt;5&gt;"
    );
  });

  it("handles empty, null, and undefined values cleanly", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
    expect(escapeHtml("")).toBe("");
  });

  it("converts numbers and booleans safely to strings", () => {
    expect(escapeHtml(12345)).toBe("12345");
    expect(escapeHtml(0)).toBe("0");
    expect(escapeHtml(true)).toBe("true");
    expect(escapeHtml(false)).toBe("false");
  });

  it("neutralizes attribute breakout vectors", () => {
    const maliciousAttr = `" onmouseover="alert('xss')`;
    expect(escapeHtml(maliciousAttr)).toBe(
      "&quot; onmouseover=&quot;alert(&#39;xss&#39;)"
    );
    expect(escapeHtml("'><svg onload=alert(1)>")).toBe(
      "&#39;&gt;&lt;svg onload=alert(1)&gt;"
    );
  });
});

describe("Safe Redirect Validator (getSafeRedirectUrl)", () => {
  it("allows safe same-origin relative paths", () => {
    expect(getSafeRedirectUrl("/")).toBe("/");
    expect(getSafeRedirectUrl("/cart")).toBe("/cart");
    expect(getSafeRedirectUrl("/account")).toBe("/account");
    expect(getSafeRedirectUrl("/account?tab=orders&page=2")).toBe(
      "/account?tab=orders&page=2"
    );
    expect(getSafeRedirectUrl("/product/super-gan-65w#specifications")).toBe(
      "/product/super-gan-65w#specifications"
    );
  });

  it("rejects protocol-relative URLs (e.g. //attacker.com)", () => {
    expect(getSafeRedirectUrl("//attacker.com")).toBe("/");
    expect(getSafeRedirectUrl("//google.com/login")).toBe("/");
    expect(getSafeRedirectUrl("///attacker.com")).toBe("/");
  });

  it("rejects backslash bypasses (e.g. /\\attacker.com or \\\\attacker.com)", () => {
    expect(getSafeRedirectUrl("/\\attacker.com")).toBe("/");
    expect(getSafeRedirectUrl("\\attacker.com")).toBe("/");
    expect(getSafeRedirectUrl("/page\\sub")).toBe("/");
  });

  it("rejects absolute URLs and arbitrary schemes", () => {
    expect(getSafeRedirectUrl("http://attacker.com")).toBe("/");
    expect(getSafeRedirectUrl("https://attacker.com")).toBe("/");
    expect(getSafeRedirectUrl("javascript:alert(1)")).toBe("/");
    expect(getSafeRedirectUrl("data:text/html,<script>alert(1)</script>")).toBe(
      "/"
    );
    expect(getSafeRedirectUrl("vbscript:msgbox(1)")).toBe("/");
  });

  it("rejects scheme prefixes in path segment", () => {
    expect(getSafeRedirectUrl("/javascript:alert(1)")).toBe("/");
    expect(getSafeRedirectUrl("/http:attacker.com")).toBe("/");
  });

  it("rejects CRLF and control characters", () => {
    expect(getSafeRedirectUrl("/cart\r\nSet-Cookie:evil=1")).toBe("/");
    expect(getSafeRedirectUrl("/cart\nSet-Cookie:evil=1")).toBe("/");
    expect(getSafeRedirectUrl("/cart\x00evil")).toBe("/");
    expect(getSafeRedirectUrl("/cart\x1bevil")).toBe("/");
  });

  it("respects custom fallback path when valid, falls back to '/' if invalid", () => {
    expect(getSafeRedirectUrl("https://evil.com", "/account")).toBe("/account");
    expect(getSafeRedirectUrl("https://evil.com", "//evil.com")).toBe("/");
    expect(getSafeRedirectUrl("https://evil.com", "https://evil.com")).toBe("/");
    expect(getSafeRedirectUrl("invalid", "/login")).toBe("/login");
  });

  it("handles non-string inputs safely", () => {
    expect(getSafeRedirectUrl(null)).toBe("/");
    expect(getSafeRedirectUrl(undefined)).toBe("/");
    expect(getSafeRedirectUrl(12345)).toBe("/");
    expect(getSafeRedirectUrl({})).toBe("/");
  });
});

describe("Text Sanitization (sanitizeText)", () => {
  it("strips non-printable ASCII control characters", () => {
    const dirty = "Urbanrat\x00\x07Wholesale\x1B\x7FDepot";
    expect(sanitizeText(dirty)).toBe("UrbanratWholesaleDepot");
  });

  it("preserves newlines and tabs when appropriate", () => {
    const textWithNewlines = "Line 1\nLine 2\tTabbed";
    expect(sanitizeText(textWithNewlines)).toBe("Line 1\nLine 2\tTabbed");
  });

  it("caps text to specified maxLength", () => {
    const longText = "A".repeat(100);
    expect(sanitizeText(longText, 60)).toHaveLength(60);
    expect(sanitizeText("Hello World", 5)).toBe("Hello");
  });

  it("handles null, undefined, and non-strings cleanly", () => {
    expect(sanitizeText(null)).toBe("");
    expect(sanitizeText(undefined)).toBe("");
    expect(sanitizeText(9999)).toBe("9999");
  });
});

describe("Honeypot Validation (validateHoneypot)", () => {
  it("passes when honeypot field is empty or undefined", () => {
    expect(validateHoneypot()).toBe(true);
    expect(validateHoneypot(undefined)).toBe(true);
    expect(validateHoneypot(null)).toBe(true);
    expect(validateHoneypot("")).toBe(true);
    expect(validateHoneypot("   ")).toBe(true);
  });

  it("fails when honeypot field contains automated input", () => {
    expect(validateHoneypot("bot-value")).toBe(false);
    expect(validateHoneypot("http://spam.org")).toBe(false);
  });
});

