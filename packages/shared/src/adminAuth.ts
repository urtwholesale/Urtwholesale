/**
 * Admin authorization evaluation logic matching public.is_admin() in PostgreSQL.
 *
 * Evaluates whether a user session meets administrator authorization criteria,
 * including safe-rollout TOTP multi-factor authentication (AAL2) enforcement.
 */

export interface AdminAuthContext {
  userId: string | null | undefined;
  role: string | null | undefined;
  aal?: string | null;
  enforceAdminMfa: boolean;
}

/**
 * Evaluates admin authorization corresponding directly to SQL logic in public.is_admin():
 * - User must be authenticated (userId present)
 * - User role must be 'admin'
 * - When enforceAdminMfa is true, session AAL (Authenticator Assurance Level) must be 'aal2'
 * - When enforceAdminMfa is false, AAL1 is permitted during safe rollout
 * - Non-admin users are strictly denied regardless of AAL
 */
export function verifyAdminAuthorization({
  userId,
  role,
  aal,
  enforceAdminMfa,
}: AdminAuthContext): boolean {
  // 1. Must be an authenticated user with role 'admin'
  if (!userId || role !== "admin") {
    return false;
  }

  // 2. If safe rollout mode is active (enforceAdminMfa = false), permit admin without AAL2
  if (!enforceAdminMfa) {
    return true;
  }

  // 3. When enforcement is active, strictly require AAL2
  return aal === "aal2";
}

