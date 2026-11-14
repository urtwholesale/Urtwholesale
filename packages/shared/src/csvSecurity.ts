/**
 * packages/shared/src/csvSecurity.ts
 * Security utility for neutralizing CSV / Spreadsheet Formula Injection (CWE-1236).
 *
 * When untrusted strings (e.g. customer names, addresses, SKUs, or notes) are exported
 * to CSV or Excel, any cell starting with formula trigger characters (=, +, -, @, \t, \r)
 * can be interpreted as executable formulas or DDE macros by spreadsheet software.
 * Prepending a single quote (') forces spreadsheet applications to treat the cell
 * content strictly as plain text.
 *
 * NOTE: Formula triggers are stored as discrete checks to completely avoid regex range
 * hazards (such as /^[=+@-|\t\r]/ which accidentally creates an ASCII range from '@' to '|').
 */

const FORMULA_TRIGGERS = new Set<string>(["=", "+", "-", "@"]);

/**
 * Sanitizes a single cell value to prevent formula injection.
 * If the value is a string starting with a formula trigger character, prepends a single quote (').
 */
export function sanitizeSpreadsheetCell(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  // Neutralize tab or carriage return at the very beginning of the raw string
  if (value.startsWith("\t") || value.startsWith("\r")) {
    return `'${value}`;
  }

  // Neutralize formula trigger characters (=, +, -, @) even after leading spaces
  const trimmed = value.trimStart();
  const firstChar = trimmed[0];
  if (firstChar && FORMULA_TRIGGERS.has(firstChar)) {
    return `'${value}`;
  }

  return value;
}

/**
 * Sanitizes an array of row values or a key-value record before spreadsheet export.
 */
export function sanitizeSpreadsheetRow<T extends Record<string, unknown> | unknown[]>(row: T): T {
  if (Array.isArray(row)) {
    return row.map((cell) => sanitizeSpreadsheetCell(cell)) as T;
  }

  const sanitizedRecord: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(row)) {
    sanitizedRecord[key] = sanitizeSpreadsheetCell(val);
  }
  return sanitizedRecord as T;
}
