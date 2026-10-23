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
  QrCode,
} from "lucide-react";

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
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [credSaving, setCredSaving] = useState(false);
  const [credToast, setCredToast] = useState(false);
  const [credError, setCredError] = useState<string | null>(null);

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
        if (newPassword.length < 6) {
          throw new Error("Password must be at least 6 characters long");
        }
        if (newPassword !== confirmPassword) {
          throw new Error("New password and confirmation do not match");
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
            className="py-2.5 px-6 rounded-xl text-white font-semibold text-xs transition active:scale-95 shadow-sm cursor-pointer disabled:opacity-60 flex items-center space-x-2"
            style={{
              background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)",
            }}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 mb-1">
                <KeyRound className="w-3.5 h-3.5 text-brand-dark" />
                <span>New Master Password</span>
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Leave blank to keep current"
                minLength={6}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-dark focus:bg-white transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                minLength={6}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-dark focus:bg-white transition"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={credSaving}
              className="py-2.5 px-6 rounded-xl text-white font-semibold text-xs transition active:scale-95 shadow-sm cursor-pointer disabled:opacity-60 flex items-center space-x-2"
              style={{
                background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)",
              }}
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
    </div>
  );
}
