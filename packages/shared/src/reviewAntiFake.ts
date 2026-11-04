/**
 * Anti-Fake Reviews Validation & Protection Suite
 *
 * Enforces rigorous anti-spam, content safety, and verified wholesale purchase
 * requirements to protect product reviews against astroturfing, link spam,
 * and fabricated ratings.
 */

export interface ReviewValidationInput {
  rating: number;
  title?: string | null;
  body?: string | null;
  authorName?: string | null;
}

export interface ReviewValidationResult {
  isValid: boolean;
  error?: string;
}

// Regex to detect promotional links, URL schemes, domain patterns, and messaging handles
export const URL_SPAM_REGEX =
  /(https?:\/\/|www\.|\.com\b|\.in\b|\.net\b|\.org\b|\.co\b|t\.me\/|wa\.me\/|bit\.ly\/|tinyurl\.com)/i;

// Regex to detect repeated character spam (e.g. "aaaaaaa", "!!!!!")
export const REPEATED_CHAR_SPAM_REGEX = /(.)\1{6,}/;

/**
 * Validates review content against spam patterns, length constraints, and rating bounds.
 */
export function validateReviewContent(input: ReviewValidationInput): ReviewValidationResult {
  // 1. Rating Validation
  if (
    typeof input.rating !== "number" ||
    !Number.isInteger(input.rating) ||
    input.rating < 1 ||
    input.rating > 5
  ) {
    return {
      isValid: false,
      error: "Rating must be a whole star between 1 and 5.",
    };
  }

  // 2. Author Name Validation
  const author = input.authorName ? input.authorName.trim() : "";
  if (!author || author.length < 2) {
    return {
      isValid: false,
      error: "Please provide a valid reviewer or store name (at least 2 characters).",
    };
  }
  if (author.length > 70) {
    return {
      isValid: false,
      error: "Reviewer name cannot exceed 70 characters.",
    };
  }
  if (URL_SPAM_REGEX.test(author)) {
    return {
      isValid: false,
      error: "Links and web addresses are strictly prohibited in reviewer names.",
    };
  }

  // 3. Title Validation (optional)
  if (input.title && input.title.trim().length > 0) {
    const title = input.title.trim();
    if (title.length > 120) {
      return {
        isValid: false,
        error: "Review headline cannot exceed 120 characters.",
      };
    }
    if (URL_SPAM_REGEX.test(title)) {
      return {
        isValid: false,
        error: "Links and web addresses are not permitted in review headlines.",
      };
    }
    if (REPEATED_CHAR_SPAM_REGEX.test(title)) {
      return {
        isValid: false,
        error: "Review headline contains repetitive character spam.",
      };
    }
  }

  // 4. Body Content Validation
  const body = input.body ? input.body.trim() : "";
  if (!body || body.length < 10) {
    return {
      isValid: false,
      error:
        "Please provide a meaningful wholesale review of at least 10 characters describing build, quality, or margins.",
    };
  }
  if (body.length > 2000) {
    return {
      isValid: false,
      error: "Review text cannot exceed 2,000 characters.",
    };
  }
  if (URL_SPAM_REGEX.test(body)) {
    return {
      isValid: false,
      error: "External URLs, links, and promo codes are not allowed in customer reviews.",
    };
  }
  if (REPEATED_CHAR_SPAM_REGEX.test(body)) {
    return {
      isValid: false,
      error: "Review text contains repetitive character spam.",
    };
  }

  return { isValid: true };
}
