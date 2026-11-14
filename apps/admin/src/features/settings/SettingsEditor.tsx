import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import {
  Save,
  Check,
  Loader2,
  Phone,
  Search,
  Store,
  KeyRound,
  ShieldCheck,
  User,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  QrCode,
  Eye,
  EyeOff,
  RefreshCw,
  Users,
  ShieldAlert,
} from "lucide-react";
import {
  fetchAdminMfaAuditStatus,
  type AdminMfaAuditStatus,
} from "../../lib/adminService";

export function SettingsEditor() {
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [upiId, setUpiId] = useState("7000947033-1@okbizaxis");
  const [popularSearches, setPopularSearches] = useState("");
  const [storeName, setStoreName] = useState("");
  const [tagline, setTagline] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Admin Credentials State
  const [adminUsername, setAdminUsername] = useState("Sjainthelegend");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [credSaving, setCredSaving] = useState(false);
  const [credToast, setCredToast] = useState(false);
  const [credError, setCredError] = useState<string | null>(null);

  // Two-Factor Authentication (TOTP MFA) State
  const [mfaFactors, setMfaFactors] = useState<any[]>([]);
  const [mfaEnrolling, setMfaEnrolling] = useState(false);
  const [mfaQrCode, setMfaQrCode] = useState<string | null>(null);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaVerificationCode, setMfaVerificationCode] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaSuccess, setMfaSuccess] = useState<string | null>(null);

  // Admin MFA Rollout & Enforcement Audit State
  const [mfaAudit, setMfaAudit] = useState<AdminMfaAuditStatus | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);

  async function loadMfaFactors() {
    try {
      const { data, error: mfaErr } = await supabase.auth.mfa.listFactors();
      if (!mfaErr && data) {
        setMfaFactors(data.totp || []);
      }
    } catch {
      // Ignore
    }
  }

  async function loadMfaAudit() {
    setAuditLoading(true);
    try {
      const res = await fetchAdminMfaAuditStatus();
      setMfaAudit(res);
    } catch (err) {
      console.warn("Failed to load admin MFA audit:", err);
    } finally {
      setAuditLoading(false);
    }
  }

  async function handleStartMfaEnrollment() {
    setMfaEnrolling(true);
    setMfaError(null);
    setMfaSuccess(null);
    setMfaLoading(true);
    try {
      const { data, error: enrollErr } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        issuer: "Urbanrat Admin",
      });
      if (enrollErr) throw enrollErr;
      setMfaFactorId(data.id);
      setMfaQrCode(data.totp.qr_code);
      setMfaSecret(data.totp.secret);
    } catch (err: any) {
      setMfaError(err.message || "Failed to start MFA enrollment");
      setMfaEnrolling(false);
    } finally {
      setMfaLoading(false);
    }
  }

  async function handleVerifyAndActivateMfa(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaFactorId || !mfaVerificationCode.trim()) {
      setMfaError("Please enter the 6-digit verification code from your authenticator app.");
      return;
    }
    setMfaLoading(true);
    setMfaError(null);
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
      if (challenge.error) throw challenge.error;

      const verifyRes = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challenge.data.id,
        code: mfaVerificationCode.trim(),
      });
      if (verifyRes.error) throw verifyRes.error;

      setMfaSuccess("Two-factor authentication successfully verified and enabled!");
      setMfaEnrolling(false);
      setMfaQrCode(null);
      setMfaSecret(null);
      setMfaVerificationCode("");
      await Promise.all([loadMfaFactors(), loadMfaAudit()]);
    } catch (err: any) {
      setMfaError(err.message || "Invalid two-factor code. Please check your authenticator.");
    } finally {
      setMfaLoading(false);
    }
  }

  async function handleUnenrollMfaFactor(factorId: string) {
    if (!confirm("Are you sure you want to disable two-factor authentication for this account?")) return;
    setMfaLoading(true);
    setMfaError(null);
    try {
      const { error: unenrollErr } = await supabase.auth.mfa.unenroll({ factorId });
      if (unenrollErr) throw unenrollErr;
      setMfaSuccess("Two-factor authentication factor removed.");
      await Promise.all([loadMfaFactors(), loadMfaAudit()]);
    } catch (err: any) {
      setMfaError(err.message || "Failed to remove MFA factor");
    } finally {
      setMfaLoading(false);
    }
  }

  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true);
        const { data, error: err } = await supabase
          .from("store_settings")
          .select("key, value");

        if (err) throw err;

        if (data) {
          for (const row of data) {
            if (row.key === "whatsapp_number" && typeof row.value === "string") {
              setWhatsappNumber(row.value);
            } else if (row.key === "upi_id" && typeof row.value === "string") {
              setUpiId(row.value);
            } else if (row.key === "store_name" && typeof row.value === "string") {
              setStoreName(row.value);
            } else if (row.key === "popular_searches" && Array.isArray(row.value)) {
              setPopularSearches(row.value.join(", "));
            } else if (row.key === "store_info" && typeof row.value === "object" && row.value !== null) {
              if (row.value.name) setStoreName(row.value.name);
              setTagline(row.value.tagline || "");
            } else if (row.key === "admin_username" && typeof row.value === "string") {
              setAdminUsername(row.value);
            }
          }
        }
      } catch (err: unknown) {
        const e = err as Error;
        console.error("Failed to load store settings:", e);
        setError(e.message || "Failed to load settings");
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
    loadMfaFactors();
    loadMfaAudit();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const searchesArray = popularSearches
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      // Upsert settings
      const updates = [
        {
          key: "whatsapp_number",
          value: JSON.stringify(whatsappNumber.trim()),
          description: "Primary WhatsApp order dispatch & support number",
          updated_at: new Date().toISOString(),
        },
        {
          key: "upi_id",
          value: JSON.stringify(upiId.trim()),
          description: "Store UPI ID for receiving customer QR payments",
          updated_at: new Date().toISOString(),
        },
        {
          key: "store_name",
          value: JSON.stringify(storeName.trim()),
          description: "Store display name used in UPI and branding",
          updated_at: new Date().toISOString(),
        },
        {
          key: "popular_searches",
          value: JSON.stringify(searchesArray),
          description: "Top search keywords shown in mobile search drawer",
          updated_at: new Date().toISOString(),
        },
        {
          key: "store_info",
          value: JSON.stringify({
            name: storeName.trim(),
            tagline: tagline.trim(),
            currency: "₹",
          }),
          description: "General store branding metadata",
          updated_at: new Date().toISOString(),
        },
      ];

      for (const item of updates) {
        const { error: upsertErr } = await supabase
          .from("store_settings")
          .upsert({
            key: item.key,
            value: JSON.parse(item.value),
            description: item.description,
            updated_at: item.updated_at,
          });

        if (upsertErr) throw upsertErr;
      }

      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2500);
    } catch (err: unknown) {
      const e = err as Error;
      console.error("Save settings error:", e);
      setError(e.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateCredentials(e: React.FormEvent) {
    e.preventDefault();
    setCredSaving(true);
    setCredError(null);

    try {
      const trimmedUser = adminUsername.trim();
      if (!trimmedUser) {
        throw new Error("Admin username cannot be blank");
      }

      // If user provided a new password, validate and update in Supabase Auth
      if (newPassword) {
        if (!currentPassword) {
          throw new Error("Current password is required to change master password");
        }
        if (newPassword.length < 8) {
          throw new Error("New password must be at least 8 characters long");
        }
        if (newPassword !== confirmPassword) {
          throw new Error("New password and confirmation do not match");
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user || !user.email) {
          throw new Error("Active admin session not found");
        }

        const { error: reauthErr } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword,
        });

        if (reauthErr) {
          throw new Error("Current password verification failed. Please enter your correct current password.");
        }

        const { error: pwErr } = await supabase.auth.updateUser({
          password: newPassword,
        });

        if (pwErr) throw pwErr;
      }

      // Save admin username to store_settings
      const { error: settingErr } = await supabase
        .from("store_settings")
        .upsert({
          key: "admin_username",
          value: trimmedUser,
          description: "Configured Admin Portal Username",
          updated_at: new Date().toISOString(),
        });

      if (settingErr) throw settingErr;

      // Update current user profile full_name to match admin username
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({ full_name: trimmedUser, updated_at: new Date().toISOString() })
          .eq("id", user.id);
      }

      setCredToast(true);
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setCredToast(false), 3000);
    } catch (err: unknown) {
      const e = err as Error;
      console.error("Credentials update error:", e);
      setCredError(e.message || "Failed to update admin credentials");
    } finally {
      setCredSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm text-center">
        <Loader2 className="w-6 h-6 text-brand-dark animate-spin mx-auto mb-2" />
        <p className="text-xs text-slate-400">Loading store settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Store Settings</h2>
          <p className="text-xs text-slate-500">
            Manage WhatsApp contact, popular searches, and store metadata
          </p>
        </div>
        {savedToast && (
          <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 animate-in fade-in">
            <Check className="w-3.5 h-3.5" />
            <span>Saved to Supabase!</span>
          </span>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        {/* WhatsApp Phone */}
        <div>
          <label className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 mb-1">
            <Phone className="w-3.5 h-3.5 text-brand-dark" />
            <span>WhatsApp Dispatch &amp; Support Phone Number</span>
          </label>
          <input
            type="text"
            required
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value)}
            placeholder="919876543210"
            className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-dark focus:bg-white transition"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Include country code without '+' or spaces (e.g. 919876543210). Used for all customer WhatsApp order dispatches.
          </p>
        </div>

        {/* Store UPI ID */}
        <div>
          <label className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 mb-1">
            <QrCode className="w-3.5 h-3.5 text-brand-dark" />
            <span>Store UPI ID for Payments</span>
          </label>
          <input
            type="text"
            required
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            placeholder="7000947033-1@okbizaxis"
            className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-dark focus:bg-white transition"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            UPI ID displayed to customers in WhatsApp messages and encoded into the order dynamic QR code.
          </p>
        </div>

        {/* Popular Searches */}
        <div>
          <label className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 mb-1">
            <Search className="w-3.5 h-3.5 text-brand-dark" />
            <span>Popular Search Keywords (comma-separated)</span>
          </label>
          <input
            type="text"
            value={popularSearches}
            onChange={(e) => setPopularSearches(e.target.value)}
            placeholder="iPhone 16 Glass, 65W GaN, 100W Cable, AirBass Pro, MagSafe Car"
            className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-dark focus:bg-white transition"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Keywords displayed as one-tap chips inside the customer mobile search drawer.
          </p>
        </div>

        {/* Store Name & Tagline */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 mb-1">
              <Store className="w-3.5 h-3.5 text-brand-dark" />
              <span>Store Name</span>
            </label>
            <input
              type="text"
              required
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="URT Wholesale"
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-dark focus:bg-white transition"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Store Tagline
            </label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Factory Direct Wholesale Mobile Gear"
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-dark focus:bg-white transition"
            />
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="py-2.5 px-6 rounded-xl bg-brand-dark hover:bg-brand-dark/90 text-white font-semibold text-xs transition active:scale-95 shadow-sm cursor-pointer disabled:opacity-60 flex items-center space-x-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving to Supabase...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Store Settings</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>

      {/* Admin Portal Security & Credentials Card */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-brand-dark" />
              <h2 className="text-lg font-bold text-slate-900">
                Admin Credentials & Master Password
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Change your fixed Admin Username and Master Password. Changes take effect immediately in your live Supabase database.
            </p>
          </div>
          {credToast && (
            <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 animate-in fade-in">
              <Check className="w-3.5 h-3.5" />
              <span>Credentials Updated!</span>
            </span>
          )}
        </div>

        {credError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{credError}</span>
          </div>
        )}

        <form onSubmit={handleUpdateCredentials} className="space-y-4">
          <div>
            <label className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 mb-1">
              <User className="w-3.5 h-3.5 text-brand-dark" />
              <span>Fixed Admin Username</span>
            </label>
            <input
              type="text"
              required
              value={adminUsername}
              onChange={(e) => setAdminUsername(e.target.value)}
              placeholder="Sjainthelegend"
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-dark focus:bg-white transition"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              The login username for the Admin Portal.
            </p>
          </div>

          <div>
            <label className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 mb-1">
              <KeyRound className="w-3.5 h-3.5 text-brand-dark" />
              <span>Current Password <span className="text-slate-400 font-normal">(Required to change password)</span></span>
            </label>
            <div className="relative max-w-sm">
              <input
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-dark focus:bg-white transition"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                title={showCurrentPassword ? "Hide password" : "Show password"}
                aria-label={showCurrentPassword ? "Hide password" : "Show password"}
              >
                {showCurrentPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 mb-1">
                <KeyRound className="w-3.5 h-3.5 text-brand-dark" />
                <span>New Master Password</span>
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Leave blank to keep current"
                  minLength={6}
                  className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-dark focus:bg-white transition"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                  title={showNewPassword ? "Hide password" : "Show password"}
                  aria-label={showNewPassword ? "Hide password" : "Show password"}
                >
                  {showNewPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  minLength={6}
                  className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-dark focus:bg-white transition"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                  title={showConfirmPassword ? "Hide password" : "Show password"}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={credSaving}
              className="py-2.5 px-6 rounded-xl bg-brand-dark hover:bg-brand-dark/90 text-white font-semibold text-xs transition active:scale-95 shadow-sm cursor-pointer disabled:opacity-60 flex items-center space-x-2"
            >
              {credSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Updating Credentials...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Update Admin Credentials</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ── Admin MFA Rollout & Enrollment Audit Card ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-5 h-5 text-brand-dark" />
              <h2 className="text-lg font-bold text-slate-900">
                Admin MFA Rollout & Enrollment Audit
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Verify that all administrator accounts have enrolled a TOTP factor before enabling strict database enforcement (<code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded text-slate-700">enforce_admin_mfa</code>).
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {mfaAudit?.enforceAdminMfa ? (
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Check className="w-3.5 h-3.5" />
                <span>Enforcement: Active (AAL2 Required)</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Safe Rollout Mode (Enforcement Inactive)</span>
              </span>
            )}

            <button
              type="button"
              onClick={loadMfaAudit}
              disabled={auditLoading}
              title="Re-check administrator MFA status"
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${auditLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* ── Warning Banner: Unenrolled Admins Detected ── */}
        {mfaAudit && mfaAudit.unenrolledCount > 0 && (
          <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200/90 text-amber-900 space-y-2.5">
            <div className="flex items-start space-x-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                  Rollout Warning: {mfaAudit.unenrolledCount} Administrator Account{mfaAudit.unenrolledCount > 1 ? "s" : ""} Missing TOTP
                </h3>
                <p className="text-xs text-amber-800 mt-0.5">
                  The following administrator account{mfaAudit.unenrolledCount > 1 ? "s have" : " has"} not completed TOTP authenticator enrollment. Enabling <code className="font-mono font-semibold bg-amber-100/80 px-1 py-0.5 rounded text-amber-950">enforce_admin_mfa</code> prematurely will reject their requests to administrator RPCs and tables.
                </p>
              </div>
            </div>

            <div className="space-y-1.5 pt-1 pl-7.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                Action Required Before Enabling Enforcement:
              </p>
              {mfaAudit.admins
                .filter((admin) => !admin.hasMfa)
                .map((admin) => (
                  <div
                    key={admin.adminId}
                    className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-white/90 border border-amber-200/80 text-xs shadow-2xs"
                  >
                    <div className="flex items-center space-x-2">
                      <User className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      <span className="font-bold text-slate-900">{admin.fullName}</span>
                      {admin.email && (
                        <span className="text-slate-500 font-mono text-[11px]">({admin.email})</span>
                      )}
                      <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                        ID: {admin.adminId.slice(0, 8)}...
                      </span>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      Missing TOTP Enrollment
                    </span>
                  </div>
                ))}
            </div>

            <p className="text-[11px] text-amber-700/90 pl-7.5 pt-1">
              Have each administrator sign in, open this Settings page, and complete the enrollment wizard below before executing migration 027.
            </p>
          </div>
        )}

        {/* ── Ready Confirmation: All Admins Enrolled ── */}
        {mfaAudit && mfaAudit.admins.length > 0 && mfaAudit.unenrolledCount === 0 && (
          <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 text-emerald-900 flex items-start space-x-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                Ready for Enforcement: All {mfaAudit.admins.length} Administrator Accounts Enrolled
              </h3>
              <p className="text-xs text-emerald-800 mt-0.5">
                Every registered administrator account has a verified TOTP factor active. You can now safely apply migration <code className="font-mono font-semibold bg-emerald-100/80 px-1 py-0.5 rounded text-emerald-950">027_admin_mfa_enforcement.sql</code> to activate strict AAL2 enforcement on <code className="font-mono font-semibold bg-emerald-100/80 px-1 py-0.5 rounded text-emerald-950">public.is_admin()</code> without lockout risk.
              </p>
            </div>
          </div>
        )}

        {/* ── Registered Administrators Audit Table ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider">
            <div className="flex items-center space-x-1.5">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span>Registered Administrator Accounts ({mfaAudit?.admins.length ?? 0})</span>
            </div>
            {mfaAudit && (
              <span className="text-[11px] font-normal text-slate-500">
                {mfaAudit.admins.length - mfaAudit.unenrolledCount} / {mfaAudit.admins.length} Protected with TOTP
              </span>
            )}
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden bg-slate-50/50">
            {mfaAudit && mfaAudit.admins.length > 0 ? (
              mfaAudit.admins.map((admin) => (
                <div
                  key={admin.adminId}
                  className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:bg-slate-50 transition"
                >
                  <div className="flex items-center space-x-2.5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                      admin.hasMfa ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {admin.fullName.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">{admin.fullName}</span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {admin.email || admin.adminId}
                      </span>
                    </div>
                  </div>

                  <div>
                    {admin.hasMfa ? (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Check className="w-3 h-3" />
                        <span>Enrolled (AAL2 Active)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                        <AlertCircle className="w-3 h-3" />
                        <span>Unenrolled (Action Required)</span>
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-xs text-slate-400">
                {auditLoading ? "Auditing administrator accounts..." : "No administrator profiles found."}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Two-Factor Authentication (TOTP MFA) Card ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-brand-dark" />
              <h2 className="text-lg font-bold text-slate-900">
                Two-Factor Authentication (TOTP MFA)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Add hardware-level TOTP security (Google Authenticator, Microsoft Authenticator, 1Password) to protect administrator access.
            </p>
          </div>
          {mfaFactors.length > 0 && (
            <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Check className="w-3.5 h-3.5" />
              <span>MFA Active</span>
            </span>
          )}
        </div>

        {mfaSuccess && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center space-x-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{mfaSuccess}</span>
          </div>
        )}

        {mfaError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{mfaError}</span>
          </div>
        )}

        {/* Existing Factors List */}
        {mfaFactors.length > 0 && !mfaEnrolling && (
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Enrolled Authentication Factors
            </p>
            {mfaFactors.map((factor) => (
              <div
                key={factor.id}
                className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-xs"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-brand-light/20 text-brand-dark flex items-center justify-center font-bold">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 block">
                      {factor.friendly_name || "Authenticator App (TOTP)"}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Factor ID: {factor.id.slice(0, 8)}... • Status: {factor.status}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleUnenrollMfaFactor(factor.id)}
                  disabled={mfaLoading}
                  className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 font-semibold text-xs transition cursor-pointer disabled:opacity-50"
                >
                  Unenroll
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Enrollment Wizard */}
        {mfaEnrolling && mfaQrCode ? (
          <form onSubmit={handleVerifyAndActivateMfa} className="space-y-4 max-w-md p-4 rounded-xl border border-brand-light/30 bg-brand-light/5">
            <p className="text-xs font-bold text-brand-dark uppercase tracking-wider">
              Step 1: Scan QR Code in Authenticator App
            </p>
            <div className="bg-white p-3 rounded-xl border border-slate-200 inline-block shadow-2xs">
              <img
                src={mfaQrCode}
                alt="TOTP MFA QR Code"
                className="w-44 h-44 mx-auto object-contain"
              />
            </div>
            {mfaSecret && (
              <p className="text-[11px] text-slate-500 font-mono select-all">
                Manual Key: <span className="font-bold text-slate-800">{mfaSecret}</span>
              </p>
            )}

            <div className="pt-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Step 2: Enter 6-digit confirmation code from your app
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={mfaVerificationCode}
                onChange={(e) => setMfaVerificationCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className="w-full text-center font-mono font-bold tracking-widest text-lg px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-brand-dark transition"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={mfaLoading}
                className="flex-1 py-2 px-4 rounded-xl bg-brand-dark text-white font-bold text-xs hover:bg-brand-dark/90 transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                {mfaLoading ? "Activating..." : "Confirm & Enable MFA"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMfaEnrolling(false);
                  setMfaQrCode(null);
                  setMfaSecret(null);
                  setMfaVerificationCode("");
                }}
                className="py-2 px-3 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          mfaFactors.length === 0 && (
            <div>
              <button
                type="button"
                onClick={handleStartMfaEnrollment}
                disabled={mfaLoading}
                className="py-2.5 px-5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs transition shadow-2xs flex items-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                <QrCode className="w-4 h-4 text-brand-dark" />
                <span>Enroll Authenticator App (TOTP)</span>
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
