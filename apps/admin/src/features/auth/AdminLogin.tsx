import { useState } from "react";
import { supabase } from "../../lib/supabase";
import type { Profile } from "@urbanrat/shared";

interface AdminLoginProps {
  onSuccess: (profile: Profile) => void;
}

export function AdminLogin({ onSuccess }: AdminLoginProps) {
  const [usernameOrEmail, setUsernameOrEmail] = useState("Sjainthelegend");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      let authData: any = null;
      let authError: any = null;

      const res = await supabase.auth.signInWithPassword({
        email: authEmail,
        password,
      });

      authData = res.data;
      authError = res.error;

      // If user has custom email or fallback needed, try standard sjainthelegend@urtwholesale.com
      if (authError && !cleanInput.includes("@")) {
        const retryRes = await supabase.auth.signInWithPassword({
          email: "sjainthelegend@urtwholesale.com",
          password,
        });
        if (!retryRes.error) {
          authData = retryRes.data;
          authError = null;
        }
      }

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
            placeholder="Sjainthelegend"
            className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#0A82A8] focus:bg-white transition"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Master Password
          </label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#0A82A8] focus:bg-white transition"
          />
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
    </div>
  );
}
