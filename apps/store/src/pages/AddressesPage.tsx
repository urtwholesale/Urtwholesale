import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router";
import type {
  Address,
  CreateAddressInput,
} from "@urbanrat/shared";
import {
  listAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from "../services/addressService";
import { AddressFormModal } from "../components/AddressFormModal";
import { triggerHaptic } from "../utils/haptics";
import { formatIndianMobile } from "@urbanrat/shared";
import {
  MapPin,
  Plus,
  Star,
  Edit2,
  Trash2,
  Building2,
  FileCheck2,
  Phone,
  User,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export function AddressesPage() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);

  // Delete Confirmation State
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Setting Default State
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadAddresses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listAddresses();
      setAddresses(data);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || "Failed to load saved addresses");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  }

  function handleOpenAdd() {
    triggerHaptic("selection");
    setEditingAddress(null);
    setIsModalOpen(true);
  }

  function handleOpenEdit(addr: Address) {
    triggerHaptic("selection");
    setEditingAddress(addr);
    setIsModalOpen(true);
  }

  async function handleSaveAddress(data: CreateAddressInput) {
    if (editingAddress) {
      await updateAddress(editingAddress.id, data);
      showToast("Address updated successfully");
    } else {
      await createAddress(data);
      showToast("New address added successfully");
    }
    await loadAddresses();
  }

  async function handleSetDefault(id: string) {
    triggerHaptic("selection");
    setSettingDefaultId(id);
    try {
      await setDefaultAddress(id);
      triggerHaptic("success");
      showToast("Default address updated");
      await loadAddresses();
    } catch (err: unknown) {
      triggerHaptic("heavy");
      const e = err as Error;
      alert(e.message || "Failed to set default address");
    } finally {
      setSettingDefaultId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!deletingId) return;
    triggerHaptic("heavy");
    setIsDeleting(true);
    try {
      await deleteAddress(deletingId);
      triggerHaptic("success");
      showToast("Address removed");
      setDeletingId(null);
      await loadAddresses();
    } catch (err: unknown) {
      triggerHaptic("heavy");
      const e = err as Error;
      alert(e.message || "Failed to delete address");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="w-full max-w-3xl mx-auto py-4 sm:py-8 space-y-5 px-1 sm:px-0">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-xs font-semibold text-white shadow-lg animate-in fade-in bg-slate-900 flex items-center space-x-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Top Bar / Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-slate-900/90 rounded-3xl p-5 sm:p-6 border border-slate-100 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center space-x-3">
          <Link
            to="/account"
            onClick={() => triggerHaptic("selection")}
            aria-label="Back to account"
            className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 transition cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4.5 h-4.5" />
          </Link>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Saved Address Book
            </h1>
            <p className="text-xs text-slate-400 dark:text-slate-400">
              Manage shop, warehouse &amp; branch delivery locations
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl text-white font-bold text-xs shadow-sm hover:opacity-95 transition active:scale-95 cursor-pointer self-stretch sm:self-auto justify-center"
          style={{
            background: "var(--brand-gradient)",
            boxShadow: "var(--brand-shadow)",
          }}
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add New Address</span>
        </button>
      </div>

      {/* ── Loading State ── */}
      {loading && (
        <div className="bg-white dark:bg-slate-900/90 rounded-3xl p-12 text-center border border-slate-100 dark:border-slate-800 shadow-2xs">
          <Loader2 className="w-8 h-8 text-brand-dark dark:text-brand-light animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Loading saved addresses...</p>
        </div>
      )}

      {/* ── Error State ── */}
      {!loading && error && (
        <div className="bg-white dark:bg-slate-900/90 rounded-3xl p-8 text-center border border-rose-100 dark:border-rose-900/50 shadow-2xs space-y-3">
          <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Failed to load addresses</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{error}</p>
          </div>
          <button
            type="button"
            onClick={loadAddresses}
            className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            Try Again
          </button>
        </div>
      )}

      {/* ── Empty State ── */}
      {!loading && !error && addresses.length === 0 && (
        <div className="bg-white dark:bg-slate-900/90 rounded-3xl p-8 sm:p-12 text-center border border-slate-100 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-sky-50 dark:bg-orange-500/15 text-brand-dark dark:text-brand-light flex items-center justify-center mx-auto">
            <MapPin className="w-8 h-8 stroke-[1.8]" />
          </div>
          <div className="max-w-sm mx-auto">
            <h3 className="font-black text-base text-slate-900 dark:text-white">No saved addresses yet</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Add your shop, warehouse or business dispatch address to enjoy swift, 1-click wholesale checkout.
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center space-x-2 px-5 py-3 rounded-xl text-white font-black text-xs shadow-sm hover:opacity-95 transition active:scale-95 cursor-pointer"
            style={{
              background: "var(--brand-gradient)",
              boxShadow: "var(--brand-shadow)",
            }}
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Your First Address</span>
          </button>
        </div>
      )}

      {/* ── Address Cards Grid ── */}
      {!loading && !error && addresses.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {addresses.map((address) => (
            <div
              key={address.id}
              className={`relative bg-white dark:bg-slate-900/90 rounded-3xl p-5 border transition-all shadow-2xs flex flex-col justify-between ${
                address.is_default
                  ? "border-brand-dark dark:border-orange-500 ring-2 ring-brand-dark/15 dark:ring-orange-500/20"
                  : "border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700"
              }`}
            >
              {/* Header Badges */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {address.label}
                    </span>
                    {address.is_default && (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand-light/20 dark:bg-orange-500/20 text-brand-dark dark:text-brand-light border border-brand-dark/20 dark:border-orange-500/30">
                        <Star className="w-3 h-3 fill-current text-brand-dark dark:text-brand-light" />
                        <span>Default</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(address)}
                      title="Edit address"
                      className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white flex items-center justify-center transition cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic("heavy");
                        setDeletingId(address.id);
                      }}
                      title="Delete address"
                      className="w-8 h-8 rounded-full hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 flex items-center justify-center transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Receiver Info */}
                <div className="space-y-1 mb-3">
                  <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-bold text-sm">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{address.full_name}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400 text-xs font-medium">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{formatIndianMobile(address.phone, true)}</span>
                  </div>
                </div>

                {/* Business & GSTIN if present */}
                {(address.business_name || address.gstin) && (
                  <div className="mb-3 p-2.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs space-y-1">
                    {address.business_name && (
                      <div className="flex items-center space-x-1.5 text-slate-800 dark:text-slate-200 font-semibold">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{address.business_name}</span>
                      </div>
                    )}
                    {address.gstin && (
                      <div className="flex items-center space-x-1.5 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                        <FileCheck2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>GSTIN: {address.gstin}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Address Lines */}
                <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  <p className="font-medium text-slate-800 dark:text-slate-200">{address.line1}</p>
                  {address.line2 && <p>{address.line2}</p>}
                  {address.landmark && (
                    <p className="text-[11px] text-slate-400">Landmark: {address.landmark}</p>
                  )}
                  <p className="font-semibold text-slate-900 dark:text-white mt-1">
                    {address.city}, {address.state} – {address.pincode}
                  </p>
                </div>
              </div>

              {/* Bottom Card Actions */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                {!address.is_default ? (
                  <button
                    type="button"
                    onClick={() => handleSetDefault(address.id)}
                    disabled={settingDefaultId === address.id}
                    className="text-xs font-bold text-brand-dark dark:text-orange-400 hover:underline flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                  >
                    {settingDefaultId === address.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Star className="w-3.5 h-3.5" />
                    )}
                    <span>Set as Default</span>
                  </button>
                ) : (
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Primary Checkout Address</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Delete Confirmation Dialog ── */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full sm:max-w-sm bg-white dark:bg-slate-900 rounded-t-4xl sm:rounded-3xl p-6 shadow-2xl border border-slate-100 dark:border-slate-800 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900 dark:text-white">Delete Address?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Are you sure you want to remove this delivery location from your wholesale account?
              </p>
            </div>
            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs transition cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-1.5"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isDeleting ? "Deleting..." : "Delete"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reusable Address Form Sheet / Modal ── */}
      <AddressFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveAddress}
        initialData={editingAddress}
      />
    </div>
  );
}
