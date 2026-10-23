import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import {
  isValidGSTIN,
  isValidIndianMobile,
  cleanIndianMobile,
} from "@urbanrat/shared";
import { triggerHaptic } from "../../utils/haptics";
import {
  Lock,
  Mail,
  User as UserIcon,
  Building2,
  FileCheck2,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";

export interface CustomerAuthProps {
  onAuthSuccess?: () => void;
  onContinueGuest?: () => void;
  initialMode?: "login" | "signup";
}

export function CustomerAuth({
  onAuthSuccess,
  onContinueGuest,
  initialMode = "login",
}: CustomerAuthProps) {
  const { user, profile, signIn, signUp, signOut, resetPassword } = useAuth();

  const [mode, setMode] = useState<"login" | "signup" | "forgot">(initialMode);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form Fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [showBusinessFields, setShowBusinessFields] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [gstin, setGstin] = useState("");

  // Validation & Feedback
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isGoogleConfigured, setIsGoogleConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) return;

    fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: supabaseAnonKey },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.external?.google !== undefined) {
          setIsGoogleConfigured(Boolean(data.external.google));
        }
      })
      .catch((err) => console.warn("Supabase auth settings check skipped:", err));
  }, []);

  // If already logged in, show account card with sign out
  if (user) {
    return (
      <div className="w-full max-w-md mx-auto p-6 bg-white rounded-3xl shadow-sm border border-slate-100 text-center">
        <div className="w-16 h-16 rounded-full bg-linear-to-b from-brand-light to-brand-dark flex items-center justify-center text-white font-black text-2xl mx-auto mb-3 shadow-sm">
          {(profile?.full_name || user.email || "U")[0]?.toUpperCase()}
        </div>
        <h3 className="font-bold text-lg text-slate-900">
          {profile?.full_name || "Wholesale Customer"}
        </h3>
        <p className="text-xs text-slate-500 mb-4">{user.email}</p>

        {profile?.business_name && (
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium mb-4">
            <Building2 className="w-3.5 h-3.5 text-slate-500" />
            <span>{profile.business_name}</span>
          </div>
        )}

        <div className="pt-2">
          <button
            type="button"
            onClick={async () => {
              triggerHaptic("heavy");
              setLoading(true);
              try {
                await signOut();
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition active:scale-[0.99] text-xs cursor-pointer"
          >
            {loading ? "Signing out..." : "Sign Out"}
          </button>
        </div>
      </div>
    );
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};

    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      errors.email = "Please enter a valid email address";
    }

    if (mode === "login" || mode === "signup") {
      if (!password || password.length < 6) {
        errors.password = "Password must be at least 6 characters";
      }
    }

    if (mode === "signup") {
      if (!fullName.trim()) {
        errors.fullName = "Full name is required";
      }

      const clean = cleanIndianMobile(phone);
      if (!clean) {
        errors.phone = "Mobile number is required";
      } else if (!isValidIndianMobile(clean)) {
        errors.phone = "Enter a valid 10-digit Indian mobile number";
      }

      if (gstin.trim() && !isValidGSTIN(gstin.trim())) {
        errors.gstin = "Invalid 15-character GSTIN format (e.g. 27AAPFU0939F1ZV)";
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleGoogleSignIn() {
    triggerHaptic("selection");
    setLoading(true);
    setStatusMessage(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      let googleActive = isGoogleConfigured;
      if (googleActive === null && supabaseUrl && supabaseAnonKey) {
        try {
          const res = await fetch(`${supabaseUrl}/auth/v1/settings`, {
            headers: { apikey: supabaseAnonKey },
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.external?.google !== undefined) {
              googleActive = Boolean(data.external.google);
              setIsGoogleConfigured(googleActive);
            }
          }
        } catch {
          // Ignore network probe failure
        }
      }

      if (googleActive === false) {
        setStatusMessage({
          type: "error",
          text: "Google Sign-In is not enabled on your Supabase project yet. Please sign in with Email & Password, or enable the Google provider in your Supabase Dashboard (Authentication → Providers → Google).",
        });
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: unknown) {
      const e = err as Error;
      setStatusMessage({
        type: "error",
        text: e.message || "Failed to sign in with Google",
      });
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    triggerHaptic("selection");

    if (!validate()) {
      triggerHaptic("heavy");
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    try {
      if (mode === "login") {
        await signIn(email, password);
        triggerHaptic("success");
        onAuthSuccess?.();
      } else if (mode === "signup") {
        const { needsConfirmation } = await signUp({
          email,
          password,
          fullName,
          phone,
          businessName: businessName.trim() || undefined,
          gstin: gstin.trim() ? gstin.trim().toUpperCase() : undefined,
        });

        triggerHaptic("success");
        if (needsConfirmation) {
          setStatusMessage({
            type: "success",
            text: "Account registered! Please check your email to confirm your account.",
          });
        } else {
          onAuthSuccess?.();
        }
      } else if (mode === "forgot") {
        await resetPassword(email);
        triggerHaptic("success");
        setStatusMessage({
          type: "success",
          text: "Password reset link sent! Please check your inbox.",
        });
      }
    } catch (err: unknown) {
      triggerHaptic("heavy");
      const e = err as Error;
      setStatusMessage({
        type: "error",
        text: e.message || "Authentication request failed",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-3xl p-6 sm:p-7 shadow-xs border border-slate-100">
      {/* Brand Header */}
      <div className="text-center mb-6">
        <img
          src="/logo.png"
          alt="URT Wholesale"
          className="w-14 h-14 rounded-full mx-auto object-cover shadow-xs mb-2.5"
        />
        <h2 className="text-xl font-black text-slate-900 tracking-tight">
          {mode === "login" && "Sign In to URT Wholesale"}
          {mode === "signup" && "Create Wholesale Account"}
          {mode === "forgot" && "Reset Password"}
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          {mode === "login" && "Access wholesale tier prices & saved addresses"}
          {mode === "signup" && "Fast bulk purchasing, GST invoices & express shipping"}
          {mode === "forgot" && "Enter your email to receive a secure recovery link"}
        </p>
      </div>

      {/* Status Messages */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-2xl mb-4 text-xs font-medium flex items-start space-x-2.5 ${
            statusMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {mode === "forgot" && (
          <button
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              setMode("login");
              setStatusMessage(null);
            }}
            className="flex items-center space-x-1 text-xs font-bold text-brand-dark hover:underline mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Sign In</span>
          </button>
        )}

        {/* Full Name (Sign Up only) */}
        {mode === "signup" && (
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Contact / Full Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (formErrors.fullName) setFormErrors((p) => ({ ...p, fullName: "" }));
                }}
                placeholder="Rahul Sharma"
                className={`w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border rounded-xl outline-none transition focus:bg-white focus:border-brand-dark ${
                  formErrors.fullName ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
                }`}
              />
            </div>
            {formErrors.fullName && (
              <p className="text-[11px] text-rose-500 mt-1">{formErrors.fullName}</p>
            )}
          </div>
        )}

        {/* Mobile Number (Sign Up only) */}
        {mode === "signup" && (
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Mobile Number (10 digits) <span className="text-rose-500">*</span>
            </label>
            <div className="relative flex">
              <span className="inline-flex items-center px-3 text-xs font-bold bg-slate-100 text-slate-500 border border-r-0 border-slate-200 rounded-l-xl">
                +91
              </span>
              <input
                type="tel"
                maxLength={10}
                value={phone}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/\D/g, "");
                  setPhone(cleaned);
                  if (formErrors.phone) setFormErrors((p) => ({ ...p, phone: "" }));
                }}
                placeholder="9876543210"
                className={`w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border rounded-r-xl outline-none transition focus:bg-white focus:border-brand-dark ${
                  formErrors.phone ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
                }`}
              />
            </div>
            {formErrors.phone && (
              <p className="text-[11px] text-rose-500 mt-1">{formErrors.phone}</p>
            )}
          </div>
        )}

        {/* Email */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Email Address <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (formErrors.email) setFormErrors((p) => ({ ...p, email: "" }));
              }}
              placeholder="dealer@example.com"
              className={`w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border rounded-xl outline-none transition focus:bg-white focus:border-brand-dark ${
                formErrors.email ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
              }`}
            />
          </div>
          {formErrors.email && (
            <p className="text-[11px] text-rose-500 mt-1">{formErrors.email}</p>
          )}
        </div>

        {/* Password (Login & Sign Up) */}
        {mode !== "forgot" && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700">
                Password <span className="text-rose-500">*</span>
              </label>
              {mode === "login" && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("selection");
                    setMode("forgot");
                    setStatusMessage(null);
                  }}
                  className="text-[11px] font-bold text-brand-dark hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (formErrors.password) setFormErrors((p) => ({ ...p, password: "" }));
                }}
                placeholder="••••••••"
                className={`w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm bg-slate-50 border rounded-xl outline-none transition focus:bg-white focus:border-brand-dark ${
                  formErrors.password ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {formErrors.password && (
              <p className="text-[11px] text-rose-500 mt-1">{formErrors.password}</p>
            )}
          </div>
        )}

        {/* Optional Business Fields (Sign Up only) */}
        {mode === "signup" && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                setShowBusinessFields(!showBusinessFields);
              }}
              className="text-xs font-bold text-brand-dark hover:underline flex items-center space-x-1 cursor-pointer"
            >
              <span>{showBusinessFields ? "− Hide Business / GSTIN details" : "+ Add Wholesale / GSTIN details (optional)"}</span>
            </button>

            {showBusinessFields && (
              <div className="mt-3 p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-3 animate-in fade-in">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Business / Store Name
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="Sharma Mobile & Accessories"
                      className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-brand-dark transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    GSTIN (15 characters)
                  </label>
                  <div className="relative">
                    <FileCheck2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      maxLength={15}
                      value={gstin}
                      onChange={(e) => {
                        setGstin(e.target.value.toUpperCase());
                        if (formErrors.gstin) setFormErrors((p) => ({ ...p, gstin: "" }));
                      }}
                      placeholder="27AAPFU0939F1ZV"
                      className={`w-full pl-9 pr-3 py-2 text-xs font-mono uppercase bg-white border rounded-xl outline-none focus:border-brand-dark transition ${
                        formErrors.gstin ? "border-rose-400" : "border-slate-200"
                      }`}
                    />
                  </div>
                  {formErrors.gstin && (
                    <p className="text-[10px] text-rose-500 mt-1">{formErrors.gstin}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 py-3 px-4 rounded-xl text-white font-black text-xs sm:text-sm transition-all duration-200 active:scale-[0.98] shadow-sm cursor-pointer disabled:opacity-60 flex items-center justify-center space-x-2 bg-linear-to-b from-brand-light to-brand-dark"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>
            {mode === "login" && (loading ? "Signing in..." : "Sign In")}
            {mode === "signup" && (loading ? "Creating account..." : "Create Account")}
            {mode === "forgot" && (loading ? "Sending link..." : "Send Reset Link")}
          </span>
        </button>

        {/* Continue as Guest Button (Available in Login mode) */}
        {mode === "login" && onContinueGuest && (
          <button
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              onContinueGuest();
            }}
            className="w-full py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs transition cursor-pointer"
          >
            Continue as Guest
          </button>
        )}
      </form>

      {/* Mode Switcher */}
      <div className="text-center pt-4 border-t border-slate-100 mt-5">
        {mode === "login" ? (
          <p className="text-xs text-slate-500">
            Don't have an account?{" "}
            <button
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                setMode("signup");
                setStatusMessage(null);
              }}
              className="font-bold text-brand-dark hover:underline cursor-pointer"
            >
              Sign Up
            </button>
          </p>
        ) : mode === "signup" ? (
          <p className="text-xs text-slate-500">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                setMode("login");
                setStatusMessage(null);
              }}
              className="font-bold text-brand-dark hover:underline cursor-pointer"
            >
              Sign In
            </button>
          </p>
        ) : null}
      </div>

      {/* Google OAuth (optional fallback) */}
      {mode !== "forgot" && (
        <div className="pt-4">
          <div className="relative my-3">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100" />
            </div>
            <div className="relative flex justify-center text-[11px]">
              <span className="bg-white px-2 text-slate-400">or</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 transition font-bold text-xs text-slate-700 active:scale-[0.99] cursor-pointer"
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
            {isGoogleConfigured === false && (
              <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-normal">
                Not enabled in Supabase
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
