/**
 * Normalizes an input string or array of strings into a sanitized search keywords array.
 *
 * Rules:
 * - Accepts comma, semicolon, pipe, and newline separated text
 * - Trims whitespace
 * - Converts to lowercase
 * - Collapses inner whitespace (\s+ -> ' ')
 * - Removes duplicates (preserving first seen order)
 * - Limits to max 30 keywords per product
 * - Limits to max 50 characters per keyword
 * - Ignores empty values
 * - Optional: returns empty array for empty/null/undefined input
 */
export function normalizeKeywords(input?: string | string[] | null): string[] {
  if (!input) return [];

  const rawList: string[] = Array.isArray(input) ? input : [input];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of rawList) {
    if (typeof raw !== "string") continue;

    // Split by comma, semicolon, pipe, and newline characters
    const tokens = raw.split(/[,;|\n\r]+/);
    for (const token of tokens) {
      // 1. Trim, lowercase, collapse inner whitespace
      const cleaned = token
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ")
        .slice(0, 50)
        .trim();

      // Ignore empty values
      if (cleaned.length === 0) continue;

      // Remove duplicates while preserving first seen order
      if (!seen.has(cleaned)) {
        seen.add(cleaned);
        result.push(cleaned);

        // Max 30 keywords per product
        if (result.length >= 30) {
          return result;
        }
      }
    }
  }

  return result;
}
