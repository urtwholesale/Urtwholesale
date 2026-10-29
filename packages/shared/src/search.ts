/**
 * Shared Search Normalization, Tokenization, and Variant Generation Helpers
 *
 * Designed for wholesale mobile accessories catalog search:
 * Handles compound hardware names, slashes, plus signs, hyphens, model codes,
 * and eliminates commas and parentheses to keep PostgREST queries 100% resilient.
 */

/**
 * Normalizes a user search query for resilient, typo-tolerant search matching.
 * - Strips diacritics / accents
 * - Strips commas and parentheses (which break PostgREST .or() filter syntax)
 * - Normalizes slashes, plus signs, hyphens, and quotes into clean whitespace or separators
 * - Collapses repeated whitespace
 * - Trims and lowercases
 */
export function normalizeSearchQuery(query: string): string {
  if (!query || typeof query !== "string") return "";

  return query
    // 1. Normalize unicode diacritics/accents (e.g. é -> e)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // 2. Remove characters that break PostgREST filter clauses (commas, parens)
    .replace(/[,()]/g, " ")
    // 3. Normalize quotes and backticks
    .replace(/["'`]/g, " ")
    // 4. Normalize slashes, underscores, and special punctuation to single spaces
    .replace(/[/\\_~|!?:;*^%$#@]/g, " ")
    // 5. Keep plus signs when attached to tokens like "AR+AF" or "Pro+", space when isolated (e.g. "Fast + Strong")
    .replace(/(?:^|\s+)\+(?:\s+|$)/g, " ")
    // 6. Collapse multiple spaces
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

/**
 * Splits a search query into distinct, non-empty search tokens.
 */
export function tokenizeQuery(query: string): string[] {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return [];

  const rawTokens = normalized.split(/\s+/).filter(Boolean);
  const result: string[] = [];
  const seen = new Set<string>();

  for (const token of rawTokens) {
    if (!seen.has(token)) {
      seen.add(token);
      result.push(token);
    }

    // Split concatenated alphanumeric patterns (e.g. "iphone17" -> "iphone", "17")
    const alphaNumMatch = token.match(/^([a-z]+)(\d+)$/i);
    if (alphaNumMatch && alphaNumMatch[1] && alphaNumMatch[2]) {
      const alpha = alphaNumMatch[1].toLowerCase();
      const num = alphaNumMatch[2];
      if (!seen.has(alpha)) {
        seen.add(alpha);
        result.push(alpha);
      }
      if (!seen.has(num)) {
        seen.add(num);
        result.push(num);
      }
    }

    // Split measurement patterns (e.g. "3.5mm" -> "3.5", "mm")
    const mmMatch = token.match(/^(\d+(?:\.\d+)?)(mm|w|mah|gb|tb|a|v)$/i);
    if (mmMatch && mmMatch[1] && mmMatch[2]) {
      const val = mmMatch[1];
      const unit = mmMatch[2].toLowerCase();
      if (!seen.has(val)) {
        seen.add(val);
        result.push(val);
      }
      if (!seen.has(unit)) {
        seen.add(unit);
        result.push(unit);
      }
    }
  }

  return result;
}

/**
 * Common mobile accessory synonym & alias dictionary used for client-side search variant expansions.
 */
export const SEARCH_SYNONYM_MAP: Record<string, string[]> = {
  charger: ["adapter", "power adapter", "fast charger"],
  adapter: ["charger", "power adapter"],
  earphone: ["earbuds", "handsfree", "headset", "headphone", "tws", "buds"],
  earphones: ["earbuds", "handsfree", "headset", "headphones", "tws", "buds"],
  earbuds: ["earphone", "earphones", "tws", "buds", "airpods"],
  tws: ["buds", "earbuds", "wireless earbuds"],
  buds: ["tws", "earbuds", "earphones"],
  cable: ["cord", "wire", "data cable", "charging cable"],
  cables: ["cords", "wires", "data cables"],
  cord: ["cable", "wire", "data cable"],
  glass: ["tempered glass", "screen guard", "screen protector", "uv glass"],
  tempered: ["tempered glass", "glass", "screen protector"],
  cover: ["case", "back cover", "pouch", "skin"],
  case: ["cover", "back cover", "phone case"],
  powerbank: ["power bank", "portable charger"],
  "power bank": ["powerbank", "portable charger"],
  otg: ["otg connector", "otg adapter"],
  neckband: ["neck band", "bluetooth neckband"],
  "neck band": ["neckband", "bluetooth neckband"],
  "lens ring": ["camera protector", "lens protector", "camera ring", "ar+af"],
  "camera protector": ["lens ring", "lens protector", "camera ring"],
  iphone: ["apple"],
  apple: ["iphone"],
};

/**
 * Common typo corrections for mobile accessory terms.
 */
export const COMMON_TYPO_CORRECTIONS: Record<string, string> = {
  chargr: "charger",
  chargar: "charger",
  charjer: "charger",
  charget: "charger",
  adpater: "adapter",
  adaptor: "adapter",
  earfone: "earphone",
  erfone: "earphone",
  earfones: "earphones",
  cabel: "cable",
  caable: "cable",
  cables: "cables",
  tempred: "tempered",
  temperd: "tempered",
  tampered: "tempered",
  glss: "glass",
  glas: "glass",
  iphne: "iphone",
  iphon: "iphone",
  "i phone": "iphone",
  samsng: "samsung",
  samung: "samsung",
  relme: "realme",
  realmi: "realme",
  onplus: "oneplus",
  "one plus": "oneplus",
  "1plus": "oneplus",
  infnix: "infinix",
  infinx: "infinix",
  infinex: "infinix",
  motrola: "motorola",
  vvo: "vivo",
  opo: "oppo",
  redmi: "redmi",
  airpod: "airpods",
  headfone: "headphone",
  powrbank: "powerbank",
  powerbnk: "powerbank",
  blutooth: "bluetooth",
  bluetoth: "bluetooth",
};

/**
 * Generates search query variants to maximize hits across spaced, hyphenated,
 * and concatenated catalog patterns.
 */
export function generateSearchVariants(query: string): string[] {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return [];

  const variants = new Set<string>([normalized]);

  // 1. Typo correction substitution
  const words = normalized.split(/\s+/);
  const correctedWords = words.map((w) => COMMON_TYPO_CORRECTIONS[w] || w);
  const correctedStr = correctedWords.join(" ");
  if (correctedStr !== normalized) {
    variants.add(correctedStr);
  }

  // 2. "iphone17" <-> "iphone 17"
  const splitAlphaNum = normalized.replace(/([a-z]+)(\d+)/gi, "$1 $2");
  if (splitAlphaNum !== normalized) {
    variants.add(splitAlphaNum);
  }

  const joinAlphaNum = normalized.replace(/\b([a-z]+)\s+(\d+)\b/gi, "$1$2");
  if (joinAlphaNum !== normalized) {
    variants.add(joinAlphaNum);
  }

  // 3. "type c" <-> "type-c" <-> "typec" <-> "usb c"
  if (normalized.includes("type c") || normalized.includes("typec") || normalized.includes("type-c")) {
    variants.add(normalized.replace(/type\s*-?\s*c/g, "type c"));
    variants.add(normalized.replace(/type\s*-?\s*c/g, "type-c"));
    variants.add(normalized.replace(/type\s*-?\s*c/g, "typec"));
    variants.add(normalized.replace(/type\s*-?\s*c/g, "usb c"));
  }
  if (normalized.includes("usb c") || normalized.includes("usbc")) {
    variants.add(normalized.replace(/usb\s*-?\s*c/g, "type c"));
    variants.add(normalized.replace(/usb\s*-?\s*c/g, "type-c"));
  }

  // 4. "3.5mm" <-> "3.5 mm"
  if (/3\.5\s*mm/i.test(normalized)) {
    variants.add(normalized.replace(/3\.5\s*mm/i, "3.5mm"));
    variants.add(normalized.replace(/3\.5\s*mm/i, "3.5 mm"));
  }

  // 5. "ar af" <-> "ar+af" <-> "araf"
  if (/ar\s*\+?\s*af/i.test(normalized)) {
    variants.add(normalized.replace(/ar\s*\+?\s*af/i, "ar+af"));
    variants.add(normalized.replace(/ar\s*\+?\s*af/i, "ar af"));
  }

  // 6. "power bank" <-> "powerbank"
  if (normalized.includes("power bank")) {
    variants.add(normalized.replace("power bank", "powerbank"));
  } else if (normalized.includes("powerbank")) {
    variants.add(normalized.replace("powerbank", "power bank"));
  }

  // 7. "neck band" <-> "neckband"
  if (normalized.includes("neck band")) {
    variants.add(normalized.replace("neck band", "neckband"));
  } else if (normalized.includes("neckband")) {
    variants.add(normalized.replace("neckband", "neck band"));
  }

  // 8. "9h" <-> "9 h"
  if (/\b9h\b/i.test(normalized)) {
    variants.add(normalized.replace(/\b9h\b/i, "9 h"));
    variants.add(normalized.replace(/\b9h\b/i, "9h sapphire"));
  }

  // 9. Synonym expansion
  for (const [key, syns] of Object.entries(SEARCH_SYNONYM_MAP)) {
    if (normalized === key || normalized.includes(key)) {
      for (const syn of syns) {
        variants.add(normalized.replace(key, syn));
      }
    }
  }

  return Array.from(variants);
}

/**
 * Splits text into highlighted match fragments for instant search dropdown UI.
 */
export function highlightSearchMatch(
  text: string,
  query: string
): { text: string; highlight: boolean }[] {
  if (!text) return [];
  if (!query || !query.trim()) return [{ text, highlight: false }];

  const tokens = tokenizeQuery(query).filter((t) => t.length >= 2);
  if (tokens.length === 0) return [{ text, highlight: false }];

  // Escape special regex characters in tokens
  const escapedTokens = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escapedTokens.join("|")})`, "gi");

  const parts = text.split(regex);
  return parts.filter(Boolean).map((part) => ({
    text: part,
    highlight: tokens.some((t) => t.toLowerCase() === part.toLowerCase()),
  }));
}
