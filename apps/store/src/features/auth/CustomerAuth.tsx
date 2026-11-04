import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
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
  redirectTo?: string;
}

export function CustomerAuth({
  onAuthSuccess,
  onContinueGuest,
  initialMode = "login",
}: CustomerAuthProps) {
  const {
    user,
    profile,
    signIn,
    signUp,
    signOut,
    resetPassword,
  } = useAuth();
  const { isHindi } = useLanguage();

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
  } | null>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const err = params.get("error_description") || params.get("error");
      if (err) {
        return {
          type: "error",
          text: decodeURIComponent(err.replace(/\+/g, " ")),
        };
      }
    }
    return null;
  });

  // If already logged in, show account card with sign out
  if (user) {
    return (
      <div className="w-full max-w-md mx-auto p-6 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-white/10 text-center">
        <div className="w-16 h-16 rounded-full bg-primary text-on-primary flex items-center justify-center font-black text-2xl mx-auto mb-3 shadow-xs">
          {(profile?.full_name || user.email || "U")[0]?.toUpperCase()}
        </div>
        <h3 className="font-bold text-lg text-slate-900 dark:text-white">
          {profile?.full_name || (isHindi ? "थोक ग्राहक" : "Wholesale Customer")}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{user.email}</p>

        {profile?.business_name && (
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium mb-4">
            <Building2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
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
            className="w-full h-9 px-3 rounded-xl bg-transparent border border-surface-border text-slate-700 dark:text-slate-200 hover:bg-surface-card-subtle shadow-xs font-semibold text-xs focus-visible:ring-2 ring-ring ring-offset-2 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            {loading ? (isHindi ? "लॉग आउट हो रहा है..." : "Signing out...") : (isHindi ? "लॉग आउट करें" : "Sign Out")}
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
    <div className="w-full max-w-md mx-auto bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 shadow-xs border border-slate-100 dark:border-white/10">
      {/* Brand Header */}
      <div className="text-center mb-6">
        <img
          src="/logo.png"
          alt="URT Wholesale"
          className="w-14 h-14 rounded-full mx-auto object-cover shadow-xs mb-2.5"
        />
        <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
          {mode === "login" && (isHindi ? "URT होलसेल में लॉगिन करें" : "Sign In to URT Wholesale")}
          {mode === "signup" && (isHindi ? "थोक खाता बनाएं" : "Create Wholesale Account")}
          {mode === "forgot" && (isHindi ? "पासवर्ड रीसेट करें" : "Reset Password")}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {mode === "login" && (isHindi ? "थोक रेट और सहेजे गए पतों तक पहुंचें" : "Access wholesale tier prices & saved addresses")}
          {mode === "signup" && (isHindi ? "थोक खरीदारी, पक्का जीएसटी बिल एवं एक्सप्रेस शिपिंग" : "Fast bulk purchasing, GST invoices & express shipping")}
          {mode === "forgot" && (isHindi ? "रिकवरी लिंक प्राप्त करने के लिए अपना ईमेल दर्ज करें" : "Enter your email to receive a secure recovery link")}
        </p>
      </div>

      {/* Status Messages */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-2xl mb-4 text-xs font-medium flex items-start space-x-2.5 ${
            statusMessage.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50"
              : "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
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
            className="flex items-center space-x-1 text-xs font-bold text-brand-dark dark:text-brand-light hover:underline mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{isHindi ? "लॉगिन पर वापस जाएं" : "Back to Sign In"}</span>
          </button>
        )}

        {/* Full Name (Sign Up only) */}
        {mode === "signup" && (
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isHindi ? "संपर्क / पूरा नाम" : "Contact / Full Name"} <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (formErrors.fullName) setFormErrors((p) => ({ ...p, fullName: "" }));
                }}
                placeholder="Rahul Sharma"
                className={`w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl outline-none transition focus:bg-white dark:focus:bg-slate-800 focus:border-brand-dark dark:focus:border-brand-light ${
                  formErrors.fullName ? "border-rose-400 dark:border-rose-500 bg-rose-50/30 dark:bg-rose-950/20" : "border-slate-200 dark:border-slate-700"
                }`}
              />
            </div>
            {formErrors.fullName && (
              <p className="text-[11px] text-rose-500 dark:text-rose-400 mt-1">{formErrors.fullName}</p>
            )}
          </div>
        )}

        {/* Mobile Number (Sign Up only) */}
        {mode === "signup" && (
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isHindi ? "मोबाइल नंबर (10 अंक)" : "Mobile Number (10 digits)"} <span className="text-rose-500">*</span>
            </label>
            <div className="relative flex">
              <span className="inline-flex items-center px-3 text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-r-0 border-slate-200 dark:border-slate-700 rounded-l-xl">
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
                className={`w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-r-xl outline-none transition focus:bg-white dark:focus:bg-slate-800 focus:border-brand-dark dark:focus:border-brand-light ${
                  formErrors.phone ? "border-rose-400 dark:border-rose-500 bg-rose-50/30 dark:bg-rose-950/20" : "border-slate-200 dark:border-slate-700"
                }`}
              />
            </div>
            {formErrors.phone && (
              <p className="text-[11px] text-rose-500 dark:text-rose-400 mt-1">{formErrors.phone}</p>
            )}
          </div>
        )}

        {/* Email */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            {isHindi ? "ईमेल पता" : "Email Address"} <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (formErrors.email) setFormErrors((p) => ({ ...p, email: "" }));
              }}
              placeholder="dealer@example.com"
              className={`w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl outline-none transition focus:bg-white dark:focus:bg-slate-800 focus:border-brand-dark dark:focus:border-brand-light ${
                formErrors.email ? "border-rose-400 dark:border-rose-500 bg-rose-50/30 dark:bg-rose-950/20" : "border-slate-200 dark:border-slate-700"
              }`}
            />
          </div>
          {formErrors.email && (
            <p className="text-[11px] text-rose-500 dark:text-rose-400 mt-1">{formErrors.email}</p>
          )}
        </div>

        {/* Password (Login & Sign Up) */}
        {mode !== "forgot" && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                {isHindi ? "पासवर्ड" : "Password"} <span className="text-rose-500">*</span>
              </label>
              {mode === "login" && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("selection");
                    setMode("forgot");
                    setStatusMessage(null);
                  }}
                  className="text-[11px] font-bold text-brand-dark dark:text-brand-light hover:underline cursor-pointer"
                >
                  {isHindi ? "पासवर्ड भूल गए?" : "Forgot password?"}
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (formErrors.password) setFormErrors((p) => ({ ...p, password: "" }));
                }}
                placeholder="••••••••"
                className={`w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl outline-none transition focus:bg-white dark:focus:bg-slate-800 focus:border-brand-dark dark:focus:border-brand-light ${
                  formErrors.password ? "border-rose-400 dark:border-rose-500 bg-rose-50/30 dark:bg-rose-950/20" : "border-slate-200 dark:border-slate-700"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {formErrors.password && (
              <p className="text-[11px] text-rose-500 dark:text-rose-400 mt-1">{formErrors.password}</p>
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
              className="text-xs font-bold text-brand-dark dark:text-brand-light hover:underline flex items-center space-x-1 cursor-pointer"
            >
              <span>{showBusinessFields ? (isHindi ? "− व्यापार / जीएसटी विवरण छिपाएं" : "− Hide Business / GSTIN details") : (isHindi ? "+ थोक / जीएसटी विवरण जोड़ें (वैकल्पिक)" : "+ Add Wholesale / GSTIN details (optional)")}</span>
            </button>

            {showBusinessFields && (
              <div className="mt-3 p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/80 border border-slate-200/80 dark:border-white/10 space-y-3 animate-in fade-in">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    {isHindi ? "दुकान / व्यापार का नाम" : "Business / Store Name"}
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    <input
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="Sharma Mobile & Accessories"
                      className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl outline-none focus:border-brand-dark dark:focus:border-brand-light transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    {isHindi ? "जीएसटीआईएन (15 अक्षर)" : "GSTIN (15 characters)"}
                  </label>
                  <div className="relative">
                    <FileCheck2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    <input
                      type="text"
                      maxLength={15}
                      value={gstin}
                      onChange={(e) => {
                        setGstin(e.target.value.toUpperCase());
                        if (formErrors.gstin) setFormErrors((p) => ({ ...p, gstin: "" }));
                      }}
                      placeholder="27AAPFU0939F1ZV"
                      className={`w-full pl-9 pr-3 py-2 text-xs font-mono uppercase bg-white dark:bg-slate-900 border text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl outline-none focus:border-brand-dark dark:focus:border-brand-light transition ${
                        formErrors.gstin ? "border-rose-400 dark:border-rose-500" : "border-slate-200 dark:border-slate-700"
                      }`}
                    />
                  </div>
                  {formErrors.gstin && (
                    <p className="text-[10px] text-rose-500 dark:text-rose-400 mt-1">{formErrors.gstin}</p>
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
          className="w-full mt-2 h-11 px-4 rounded-xl bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-active shadow-xs font-semibold text-sm focus-visible:ring-2 ring-ring ring-offset-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>
            {mode === "login" && (loading ? (isHindi ? "लॉगिन हो रहा है..." : "Signing in...") : (isHindi ? "लॉगिन करें" : "Sign In"))}
            {mode === "signup" && (loading ? (isHindi ? "खाता बन रहा है..." : "Creating account...") : (isHindi ? "खाता बनाएं" : "Create Account"))}
            {mode === "forgot" && (loading ? (isHindi ? "लिंक भेजा जा रहा है..." : "Sending link...") : (isHindi ? "रीसेट लिंक भेजें" : "Send Reset Link"))}
          </span>
        </button>

        {/* {isHindi ? "अतिथि के रूप में जारी रखें" : "Continue as Guest"} Button (Available in Login mode) */}
        {mode === "login" && onContinueGuest && (
          <button
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              onContinueGuest();
            }}
            className="w-full h-11 px-4 rounded-xl bg-transparent border border-surface-border text-slate-700 dark:text-slate-200 hover:bg-surface-card-subtle shadow-xs font-semibold text-sm focus-visible:ring-2 ring-ring ring-offset-2 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            Continue as Guest
          </button>
        )}
      </form>

      {/* Mode Switcher */}
      <div className="text-center pt-4 border-t border-slate-100 dark:border-white/10 mt-5">
        {mode === "login" ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isHindi ? "खाता नहीं है? " : "Don't have an account? "}
            <button
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                setMode("signup");
                setStatusMessage(null);
              }}
              className="font-bold text-brand-dark dark:text-brand-light hover:underline cursor-pointer"
            >
              {isHindi ? "साइन अप करें" : "Sign Up"}
            </button>
          </p>
        ) : mode === "signup" ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isHindi ? "पहले से खाता है? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                setMode("login");
                setStatusMessage(null);
              }}
              className="font-bold text-brand-dark dark:text-brand-light hover:underline cursor-pointer"
            >
              {isHindi ? "लॉगिन करें" : "Sign In"}
            </button>
          </p>
        ) : null}
      </div>

    </div>
  );
}
