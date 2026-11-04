/**
 * @file returns.ts
 * Shared utilities, constants, and helpers for returns management and evidence handling.
 */

/**
 * Maximum Time-to-Live (TTL in seconds) for private return-evidence signed URLs.
 * 900 seconds = 15 minutes.
 */
export const RETURN_EVIDENCE_URL_TTL_SECONDS = 900;

/**
 * Storage bucket ID for private customer return dispute evidence.
 */
export const RETURN_EVIDENCE_BUCKET = "return-evidence";

/**
 * Minimal structural interface for Supabase Storage signed URL operations.
 * Allows decoupling @urbanrat/shared from direct @supabase/supabase-js dependency.
 */
export interface StorageSignedUrlClient {
  from(bucket: string): {
    createSignedUrl(
      path: string,
      expiresIn: number
    ): Promise<{ data: { signedUrl: string } | null; error: unknown }>;
  };
}

/**
 * Generates an on-demand temporary signed URL to view private return evidence.
 * Strictly caps the expiration at RETURN_EVIDENCE_URL_TTL_SECONDS (900 seconds / 15 minutes).
 *
 * @param storage - Supabase storage client or compatible adapter
 * @param filePath - Relative path to the file in the return-evidence bucket
 * @param requestedTtl - Desired expiration in seconds (automatically capped at 900s)
 * @returns Temporary signed URL string, or empty string on error / invalid path
 */
export async function getReturnEvidenceSignedUrl(
  storage: StorageSignedUrlClient,
  filePath: string,
  requestedTtl: number = RETURN_EVIDENCE_URL_TTL_SECONDS
): Promise<string> {
  if (!filePath || typeof filePath !== "string") {
    return "";
  }

  const cleanPath = filePath.trim();
  if (!cleanPath) return "";

  // If path is already a fully qualified URL (e.g. mock or external preview), return as-is
  if (
    cleanPath.startsWith("http://") ||
    cleanPath.startsWith("https://") ||
    cleanPath.startsWith("data:")
  ) {
    return cleanPath;
  }

  // Strictly enforce maximum TTL of 900 seconds (15 minutes), clamped to at least 1s
  const ttl = Math.min(
    Math.max(1, Math.floor(requestedTtl)),
    RETURN_EVIDENCE_URL_TTL_SECONDS
  );

  try {
    const { data, error } = await storage
      .from(RETURN_EVIDENCE_BUCKET)
      .createSignedUrl(cleanPath, ttl);

    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }

    if (error) {
      console.warn("[getReturnEvidenceSignedUrl] Storage signing failed:", error);
    }
  } catch (err) {
    console.warn("[getReturnEvidenceSignedUrl] Exception while creating signed URL:", err);
  }

  return "";
}

