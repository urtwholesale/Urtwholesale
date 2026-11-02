import { useState } from "react";
import { supabase } from "../../lib/supabase";
import type { Profile } from "@urbanrat/shared";
import { Eye, EyeOff } from "lucide-react";

interface AdminLoginProps {
  onSuccess: (profile: Profile) => void;
}

export function AdminLogin({ onSuccess }: AdminLoginProps) {
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Two-factor authentication (TOTP) challenge state
  const [mfaRequired, setMfaRequired] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [pendingProfile, setPendingProfile] = useState<Profile | null>(null);

  async function handleVerifyMfa(e: React.FormEvent) {
    e.preventDefault();
    const cleanCode = totpCode.trim();
    if (!cleanCode || cleanCode.length !== 6) {
      setError("Please enter the 6-digit verification code from your authenticator app.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;
      const totpFactor = factors.totp?.[0];
      if (!totpFactor) {
        throw new Error("No TOTP authenticator factor found for this account.");
      }

      const challenge = await supabase.auth.mfa.challenge({ factorId: totpFactor.id });
      if (challenge.error) throw challenge.error;

      const verifyRes = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challenge.data.id,
        code: cleanCode,
      });
      if (verifyRes.error) throw verifyRes.error;

      if (pendingProfile) {
        onSuccess(pendingProfile);
      }
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || "Invalid two-factor code. Please check your authenticator app.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const cleanInput = usernameOrEmail.trim();
      let authEmail = cleanInput.toLowerCase();

      // If user inputs username without domain (e.g. "Sjainthelegend"), map to admin auth email
      if (!authEmail.includes("@")) {
        authEmail = `${authEmail}@urtwholesale.com`;
      }

      // Authenticate with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password,
      });

      if (authError) {
        throw new Error(
          authError.message === "Invalid login credentials"
            ? "Invalid username or password. Please verify your credentials."
            : authError.message
        );
      }

      const user = authData?.user;
      if (!user) {
        throw new Error("No user session returned");
      }

      // Verify role = 'admin' from profiles table
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        await supabase.auth.signOut().catch(() => {});
        throw new Error(
          "Access denied: Unable to verify user profile in database."
        );
      }

      if (profile.role !== "admin") {
        await supabase.auth.signOut().catch(() => {});
        throw new Error(
          "Access denied: This account does not have administrator privileges."
        );
      }

      // Check if user has enrolled TOTP MFA
      const { data: aalData, error: aalError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (!aalError && aalData && aalData.nextLevel === "aal2" && aalData.currentLevel !== "aal2") {
        setMfaRequired(true);
        setPendingProfile(profile as Profile);
        setLoading(false);
        return;
      }

      onSuccess(profile as Profile);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm mx-auto bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sm:p-8">
      {/* Brand Header */}
      <div className="text-center mb-6">
        <img
          src="/logo.png"
          alt="Urbanrat Admin"
          className="w-14 h-14 rounded-full mx-auto object-cover shadow-sm mb-3"
        />
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          Admin Portal
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Authorized personnel only. Live Supabase credentials required.
        </p>
      </div>

      {/* Access Denied / Error Alert */}
      {error && (
        <div className="p-3.5 rounded-xl mb-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start space-x-2">
          <svg
            className="w-4 h-4 text-rose-500 mt-0.5 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span className="font-medium leading-relaxed">{error}</span>
        </div>
      )}

      {/* Form */}
      {mfaRequired ? (
        <form onSubmit={handleVerifyMfa} className="space-y-4">
          <div className="text-center p-3 rounded-xl bg-brand-light/10 border border-brand-light/30">
            <p className="text-xs font-bold text-brand-dark">Two-Factor Authentication</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Enter the 6-digit code from your authenticator app (Google Authenticator / Authy).
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              6-Digit Authenticator Code
            </label>
            <input
              type="text"
              required
              maxLength={6}
              autoFocus
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="w-full text-center tracking-widest text-lg font-mono font-bold px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-dark focus:bg-white transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl text-white font-semibold text-sm transition active:scale-[0.99] shadow-sm cursor-pointer disabled:opacity-60"
            style={{
              background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)",
            }}
          >
            {loading ? "Verifying TOTP Code..." : "Verify & Sign In"}
          </button>

          <button
            type="button"
            onClick={() => {
              setMfaRequired(false);
              setTotpCode("");
              setError(null);
            }}
            className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
          >
            Cancel and Back
          </button>
        </form>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Admin Username or Email
              </label>
              <input
                type="text"
                required
                autoComplete="username"
                value={usernameOrEmail}
                onChange={(e) => setUsernameOrEmail(e.target.value)}
                placeholder="Admin username or email"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-dark focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Master Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-dark focus:bg-white transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                  title={showPassword ? "Hide password" : "Show password"}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl text-white font-semibold text-sm transition active:scale-[0.99] shadow-sm cursor-pointer disabled:opacity-60 mt-2"
              style={{
                background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)",
              }}
            >
              {loading ? "Verifying Live Credentials..." : "Authenticate as Admin"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
