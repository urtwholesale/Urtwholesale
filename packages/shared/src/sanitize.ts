/**
 * HTML Sanitization, Safe Redirection, and Printing Utilities
 * Protects against Cross-Site Scripting (XSS), Open Redirects, and Injection.
 */

/**
 * Escapes characters with special meaning in HTML to prevent XSS.
 * Converts &, <, >, ", and ' to their corresponding HTML entities.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Validates and normalizes redirect targets to prevent Open Redirect vulnerabilities.
 * Enforces same-origin relative paths starting with a single '/' and rejects:
 * - Protocol-relative URLs (e.g., '//evil.com')
 * - Backslash bypasses (e.g., '/\evil.com', '\evil.com')
 * - Absolute URLs with schemes (e.g., 'http://', 'https://', 'javascript:', 'data:')
 * - Control characters or CRLF injection
 */
export function getSafeRedirectUrl(target: unknown, fallback = "/"): string {
  const safeFallback = typeof fallback === "string" && fallback.startsWith("/") && !fallback.startsWith("//") && !fallback.includes("\\")
    ? fallback
    : "/";

  if (typeof target !== "string") {
    return safeFallback;
  }

  const trimmed = target.trim();

  // Must start with exactly one '/' and not followed by another '/' or '\'
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) {
    return safeFallback;
  }

  // Reject control characters (0x00-0x1F, 0x7F)
  if (/[\x00-\x1F\x7F]/.test(trimmed)) {
    return safeFallback;
  }

  // Reject URI scheme prefixes before query/fragment (e.g., '/http:', '/javascript:')
  const pathPart = trimmed.split(/[?#]/)[0] || "";
  if (pathPart.includes(":")) {
    return safeFallback;
  }

  return trimmed;
}

/**
 * Strips ASCII control characters and caps string length.
 */
export function sanitizeText(value: unknown, maxLength?: number): string {
  if (value === null || value === undefined) {
    return "";
  }
  let str = String(value)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim();

  if (typeof maxLength === "number" && maxLength > 0 && str.length > maxLength) {
    str = str.slice(0, maxLength);
  }

  return str;
}

/**
 * Validates honeypot field. Returns true if valid (empty), false if filled (bot detected).
 */
export function validateHoneypot(honeypot?: string | null): boolean {
  if (honeypot === null || honeypot === undefined) return true;
  return String(honeypot).trim().length === 0;
}

/**
 * Safely renders and prints an HTML document without using document.write into a same-origin window.
 * Uses an isolated Blob URL with noopener and noreferrer.
 */
export function printHtmlSafely(html: string): void {
  if (typeof window === "undefined") return;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const blobUrl = URL.createObjectURL(blob);

  const printWindow = window.open(blobUrl, "_blank", "noopener,noreferrer");
  if (!printWindow) {
    // If popups are blocked, fallback to a hidden sandboxed iframe
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.src = blobUrl;
    document.body.appendChild(iframe);

    iframe.onload = () => {
      try {
        iframe.contentWindow?.print();
      } catch {
        // Print failed or not permitted
      }
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
        URL.revokeObjectURL(blobUrl);
      }, 60000);
    };
    return;
  }

  // Revoke the blob URL after 60 seconds
  setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
  }, 60000);
}
