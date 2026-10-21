import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import {
  isValidGSTIN,
  isValidIndianMobile,
  cleanIndianMobile,
  formatIndianMobile,
} from "@urbanrat/shared";
import { listAddresses } from "../services/addressService";
import type { Address } from "@urbanrat/shared";
import { triggerHaptic } from "../utils/haptics";
import {
  User as UserIcon,
  Phone,
  Building2,
  FileCheck2,
  MapPin,
  ShoppingBag,
  LogOut,
  Edit3,
  X,
  Check,
  Loader2,
  ShieldCheck,
  ChevronRight,
  AlertCircle,
  RotateCcw,
} from "lucide-react";

export function AccountPage() {
  const { user, profile, updateProfile, signOut } = useAuth();
  const navigate = useNavigate();

  const [addressCount, setAddressCount] = useState<number | null>(null);
  const [defaultAddress, setDefaultAddress] = useState<Address | null>(null);

  // Edit Modal State
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [gstin, setGstin] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadAddresses() {
      try {
        const list = await listAddresses();
        if (mounted) {
          setAddressCount(list.length);
          const def = list.find((a) => a.is_default) || list[0] || null;
          setDefaultAddress(def);
        }
      } catch (err) {
        console.error("Failed to load address count:", err);
      }
    }
    loadAddresses();
    return () => {
      mounted = false;
    };
  }, []);

  function openEditModal() {
    triggerHaptic("selection");
    setFullName(profile?.full_name || "");
    setPhone(profile?.phone ? cleanIndianMobile(profile.phone) : "");
    setBusinessName(profile?.business_name || "");
    setGstin(profile?.gstin || "");
    setEditError(null);
    setIsEditing(true);
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    triggerHaptic("selection");

    if (!fullName.trim()) {
      setEditError("Full name is required");
      triggerHaptic("heavy");
      return;
    }

    const clean = cleanIndianMobile(phone);
    if (clean && !isValidIndianMobile(clean)) {
      setEditError("Please enter a valid 10-digit Indian mobile number");
      triggerHaptic("heavy");
      return;
    }

    if (gstin.trim() && !isValidGSTIN(gstin.trim())) {
      setEditError("Invalid 15-character GSTIN format (e.g. 27AAPFU0939F1ZV)");
      triggerHaptic("heavy");
      return;
    }

    setIsSaving(true);
    setEditError(null);

    try {
      await updateProfile({
        fullName: fullName.trim(),
        phone: clean || undefined,
        businessName: businessName.trim() || null,
        gstin: gstin.trim() ? gstin.trim().toUpperCase() : null,
      });

      triggerHaptic("success");
      setIsEditing(false);
      setToastMessage("Profile updated successfully");
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: unknown) {
      triggerHaptic("heavy");
      const e = err as Error;
      setEditError(e.message || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSignOut() {
    triggerHaptic("heavy");
    try {
      await signOut();
      navigate("/", { replace: true });
    } catch (err) {
      console.error("Sign out error:", err);
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto py-4 sm:py-8 space-y-5 px-1 sm:px-0">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-xs font-semibold text-white shadow-lg animate-in fade-in bg-emerald-600 flex items-center space-x-1.5">
          <Check className="w-3.5 h-3.5" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── User Overview Hero ── */}
      <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-100 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-2xl bg-linear-to-b from-brand-light to-brand-dark flex items-center justify-center text-white font-black text-2xl shadow-sm shrink-0">
              {(profile?.full_name || user?.email || "U")[0]?.toUpperCase()}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                  {profile?.full_name || "Wholesale Customer"}
                </h1>
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>Verified</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{user?.email}</p>
              {profile?.business_name && (
                <p className="text-xs font-bold text-brand-dark mt-1 flex items-center space-x-1">
                  <Building2 className="w-3.5 h-3.5 inline" />
                  <span>{profile.business_name}</span>
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={openEditModal}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition active:scale-95 cursor-pointer self-stretch sm:self-auto justify-center"
          >
            <Edit3 className="w-3.5 h-3.5 text-slate-500" />
            <span>Edit Profile</span>
          </button>
        </div>

        {/* Wholesale Business Details Card */}
        <div className="mt-5 pt-5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Contact Phone
            </span>
            <div className="flex items-center space-x-2 text-slate-800 font-semibold">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {profile?.phone
                  ? formatIndianMobile(profile.phone, true)
                  : "Not provided"}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Registered GSTIN
            </span>
            <div className="flex items-center space-x-2 text-slate-800 font-semibold font-mono">
              <FileCheck2 className="w-3.5 h-3.5 text-slate-400" />
              <span>{profile?.gstin || "None (Composition/Unregistered)"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Account Navigation Cards ── */}
      <div className="space-y-3">
        {/* Address Book Card */}
        <Link
          to="/addresses"
          onClick={() => triggerHaptic("selection")}
          className="flex items-center justify-between p-4 sm:p-5 rounded-3xl bg-white border border-slate-100 shadow-2xs hover:shadow-xs hover:border-slate-200 transition-all group active:scale-[0.99]"
        >
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-sky-50 text-brand-dark flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <MapPin className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm text-slate-900">Saved Addresses</h3>
                {addressCount !== null && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                    {addressCount} {addressCount === 1 ? "address" : "addresses"}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                {defaultAddress
                  ? `Default: ${defaultAddress.label} – ${defaultAddress.city}, ${defaultAddress.pincode}`
                  : "Manage dispatch and warehouse delivery destinations"}
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-600 transition-colors shrink-0" />
        </Link>

        {/* My Orders Card */}
        <Link
          to="/my-orders"
          onClick={() => triggerHaptic("selection")}
          className="flex items-center justify-between p-4 sm:p-5 rounded-3xl bg-white border border-slate-100 shadow-2xs hover:shadow-xs hover:border-slate-200 transition-all group active:scale-[0.99]"
        >
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <ShoppingBag className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Orders &amp; Invoices</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Track live consignments, view order history &amp; download GST invoices
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-600 transition-colors shrink-0" />
        </Link>

        {/* Returns & Replacements Card */}
        <Link
          to="/returns"
          onClick={() => triggerHaptic("selection")}
          className="flex items-center justify-between p-4 sm:p-5 rounded-3xl bg-white border border-slate-100 shadow-2xs hover:shadow-xs hover:border-slate-200 transition-all group active:scale-[0.99]"
        >
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <RotateCcw className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Returns &amp; Replacements</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage return claims, warranty replacements, and refund statuses
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-600 transition-colors shrink-0" />
        </Link>
      </div>

      {/* ── Sign Out Action ── */}
      <div className="pt-2">
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full flex items-center justify-center space-x-2 py-3.5 px-4 rounded-2xl border border-rose-100 bg-rose-50/50 hover:bg-rose-50 text-rose-700 font-bold text-xs sm:text-sm transition-all active:scale-[0.99] cursor-pointer"
        >
          <LogOut className="w-4 h-4 text-rose-500" />
          <span>Sign Out of Wholesale Account</span>
        </button>
      </div>

      {/* ── Edit Profile Modal / Bottom Sheet ── */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/45 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full sm:max-w-md bg-white rounded-t-4xl sm:rounded-3xl p-6 shadow-2xl border border-slate-100 animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h3 className="font-black text-base text-slate-900">Edit Profile</h3>
                <p className="text-[11px] text-slate-400">Update your wholesale billing &amp; contact info</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error banner */}
            {editError && (
              <div className="p-3 rounded-2xl bg-rose-50 text-rose-700 border border-rose-200 text-xs flex items-center space-x-2 mb-4">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-dark focus:bg-white transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mobile Number (10 digits)
                </label>
                <div className="relative flex">
                  <span className="inline-flex items-center px-3 text-xs font-bold bg-slate-100 text-slate-500 border border-r-0 border-slate-200 rounded-l-xl">
                    +91
                  </span>
                  <input
                    type="tel"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                    placeholder="9876543210"
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-r-xl outline-none focus:border-brand-dark focus:bg-white transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Business / Store Name
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Sharma Mobile & Accessories"
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-dark focus:bg-white transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  GSTIN (15 characters)
                </label>
                <div className="relative">
                  <FileCheck2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    maxLength={15}
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    placeholder="27AAPFU0939F1ZV"
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm font-mono uppercase bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-dark focus:bg-white transition"
                  />
                </div>
              </div>

              <div className="pt-2 flex space-x-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2.5 px-4 rounded-xl text-white font-black text-xs transition active:scale-[0.98] shadow-sm cursor-pointer disabled:opacity-60 flex items-center justify-center space-x-1.5 bg-linear-to-b from-brand-light to-brand-dark"
                >
                  {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSaving ? "Saving..." : "Save Changes"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
