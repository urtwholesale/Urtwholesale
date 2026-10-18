import { useState, useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import type { Profile } from "@urbanrat/shared";

type AuthTab = "email" | "phone";

export function CustomerAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<AuthTab>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    // Initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
    });

    // Listen to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (!error && data) {
        setProfile(data as Profile);
      }
    } catch {
      // Profile could still be creating via trigger
    }
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (err: unknown) {
      const e = err as Error;
      setMessage({ type: "error", text: e.message || "Failed to sign in with Google" });
      setLoading(false);
    }
  }

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        setMessage({
          type: "success",
          text: "Registration successful! Please check your email to confirm your account.",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        setMessage({ type: "success", text: "Signed in successfully!" });
      }
    } catch (err: unknown) {
      const e = err as Error;
      setMessage({ type: "error", text: e.message || "Email authentication failed" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSendPhoneOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const formattedPhone = phone.startsWith("+") ? phone : `+91${phone.trim()}`;
      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
      });
      if (error) throw error;
      setOtpSent(true);
      setMessage({ type: "success", text: `OTP sent to ${formattedPhone}` });
    } catch (err: unknown) {
      const e = err as Error;
      setMessage({ type: "error", text: e.message || "Failed to send OTP" });
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyPhoneOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const formattedPhone = phone.startsWith("+") ? phone : `+91${phone.trim()}`;
      const { error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: otp.trim(),
        type: "sms",
      });
      if (error) throw error;
      setMessage({ type: "success", text: "Phone verified successfully!" });
      setOtpSent(false);
    } catch (err: unknown) {
      const e = err as Error;
      setMessage({ type: "error", text: e.message || "Invalid OTP" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setMessage(null);
    setLoading(false);
  }

  // Logged-in state
  if (user) {
    return (
      <div className="w-full max-w-md mx-auto p-6 bg-white rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-b from-[#5ADBE5] to-[#0A82A8] flex items-center justify-center text-white font-bold text-lg">
            {(profile?.full_name || user.email || user.phone || "U")[0]?.toUpperCase()}
          </div>
          <div>
            <h3 className="font-semibold text-slate-800">
              {profile?.full_name || "Urbanrat Customer"}
            </h3>
            <p className="text-xs text-slate-500">
              {user.email || user.phone || user.id}
            </p>
          </div>
        </div>

        <div className="space-y-2 py-3 border-y border-slate-100 text-sm text-slate-600 mb-4">
          <div className="flex justify-between">
            <span className="text-slate-400">Account Type:</span>
            <span className="font-medium capitalize text-slate-700">{profile?.role || "customer"}</span>
          </div>
          {profile?.phone && (
            <div className="flex justify-between">
              <span className="text-slate-400">Phone:</span>
              <span className="font-medium text-slate-700">{profile.phone}</span>
            </div>
          )}
        </div>

        <button
          onClick={handleSignOut}
          disabled={loading}
          className="w-full py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition active:scale-[0.99] text-sm"
        >
          {loading ? "Signing out..." : "Sign Out"}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full bg-white rounded-3xl shadow-sm border border-slate-100 p-6 sm:p-7">
      {/* Title */}
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-slate-900">
          Welcome to Urbanrat
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Sign in or create an account to start shopping
        </p>
      </div>

      {/* Google Sign-in */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 transition font-medium text-sm text-slate-700 mb-4 active:scale-[0.99]"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        <span>Continue with Google</span>
      </button>

      {/* Divider */}
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-2 text-slate-400">or continue with</span>
        </div>
      </div>

      {/* Auth Method Tabs */}
      <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl mb-4">
        <button
          type="button"
          onClick={() => {
            setTab("email");
            setMessage(null);
          }}
          className={`py-1.5 text-xs font-semibold rounded-lg transition ${
            tab === "email"
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Email
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("phone");
            setMessage(null);
          }}
          className={`py-1.5 text-xs font-semibold rounded-lg transition ${
            tab === "phone"
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Phone (OTP)
        </button>
      </div>

      {/* Alerts */}
      {message && (
        <div
          className={`p-3 rounded-xl mb-4 text-xs ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-rose-50 text-rose-700 border border-rose-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Email Form */}
      {tab === "email" && (
        <form onSubmit={handleEmailAuth} className="space-y-3">
          {isSignUp && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Rahul Sharma"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#0A82A8] focus:bg-white transition"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#0A82A8] focus:bg-white transition"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#0A82A8] focus:bg-white transition"
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
            {loading ? "Processing..." : isSignUp ? "Create Account" : "Sign In with Email"}
          </button>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setMessage(null);
              }}
              className="text-xs text-[#0A82A8] hover:underline font-medium"
            >
              {isSignUp ? "Already have an account? Sign In" : "New to Urbanrat? Create account"}
            </button>
          </div>
        </form>
      )}

      {/* Phone Form */}
      {tab === "phone" && (
        <div className="space-y-3">
          {!otpSent ? (
            <form onSubmit={handleSendPhoneOtp} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Mobile Number
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 text-xs bg-slate-100 text-slate-500 border border-r-0 border-slate-200 rounded-l-xl">
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    pattern="[0-9]{10}"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="9876543210"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-r-xl focus:outline-none focus:border-[#0A82A8] focus:bg-white transition"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  10-digit Indian mobile number
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || phone.length < 10}
                className="w-full py-2.5 px-4 rounded-xl text-white font-semibold text-sm transition active:scale-[0.99] shadow-sm cursor-pointer disabled:opacity-60"
                style={{
                  background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)",
                }}
              >
                {loading ? "Sending OTP..." : "Get OTP on Phone"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyPhoneOtp} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Enter 6-digit OTP
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="123456"
                  className="w-full px-3 py-2 text-sm text-center tracking-widest font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#0A82A8] focus:bg-white transition"
                />
              </div>

              <button
                type="submit"
                disabled={loading || otp.length < 6}
                className="w-full py-2.5 px-4 rounded-xl text-white font-semibold text-sm transition active:scale-[0.99] shadow-sm cursor-pointer disabled:opacity-60"
                style={{
                  background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)",
                }}
              >
                {loading ? "Verifying..." : "Verify & Sign In"}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setOtpSent(false)}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Change phone number
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

