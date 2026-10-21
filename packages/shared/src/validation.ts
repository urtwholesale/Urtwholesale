/**
 * Standard Indian GSTIN Regex (15 alphanumeric characters)
 * 2 digits state code + 10 char PAN + 1 entity num + 'Z' + 1 checksum digit/char
 */
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/**
 * Standard Indian 6-digit postal PIN code regex
 */
export const PINCODE_REGEX = /^[1-9][0-9]{5}$/;

/**
 * Validates 15-character Indian GSTIN format
 */
export function isValidGSTIN(gstin: string | null | undefined): boolean {
  if (!gstin) return false;
  return GSTIN_REGEX.test(gstin.trim().toUpperCase());
}

/**
 * Strips formatting characters, country code (+91 / 91), and leading zeros
 * from a phone number string to produce a clean 10-digit number if possible.
 */
export function cleanIndianMobile(raw: string | null | undefined): string {
  if (!raw) return "";
  let digits = raw.replace(/\D/g, "");

  // If prefixed with 91 and 12 digits total (e.g. 919876543210), strip 91
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    // If prefixed with 0 (e.g. 09876543210), strip 0
    digits = digits.slice(1);
  }

  return digits;
}

/**
 * Validates standard 10-digit Indian mobile number (starts with 6, 7, 8, or 9)
 */
export function isValidIndianMobile(phone: string | null | undefined): boolean {
  const clean = cleanIndianMobile(phone);
  return /^[6-9]\d{9}$/.test(clean);
}

/**
 * Formats a clean 10-digit phone number as standard +91 XXXXX XXXXX or +91XXXXXXXXXX
 */
export function formatIndianMobile(phone: string | null | undefined, spaced = false): string {
  const clean = cleanIndianMobile(phone);
  if (clean.length !== 10) return phone?.trim() || "";
  if (spaced) {
    return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
  }
  return `+91${clean}`;
}

/**
 * Validates a 6-digit Indian PIN code
 */
export function isValidPincode(pincode: string | null | undefined): boolean {
  if (!pincode) return false;
  const clean = pincode.replace(/\D/g, "");
  return PINCODE_REGEX.test(clean);
}

/**
 * Cleans a pincode string to numeric digits only
 */
export function cleanPincode(pincode: string | null | undefined): string {
  if (!pincode) return "";
  return pincode.replace(/\D/g, "").slice(0, 6);
}
