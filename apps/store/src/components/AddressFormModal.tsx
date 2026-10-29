import { useState, useEffect } from "react";
import type {
  Address,
  AddressLabel,
  CreateAddressInput,
} from "@urbanrat/shared";
import {
  INDIAN_STATES,
  ADDRESS_LABELS,
  isValidGSTIN,
  isValidIndianMobile,
  cleanIndianMobile,
  isValidPincode,
  cleanPincode,
} from "@urbanrat/shared";
import { triggerHaptic } from "../utils/haptics";
import {
  X,
  MapPin,
  User,
  Building2,
  FileCheck2,
  Navigation,
  Check,
  Loader2,
  AlertCircle,
} from "lucide-react";

export interface AddressFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateAddressInput) => Promise<void>;
  initialData?: Address | null;
  title?: string;
}

export function AddressFormModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  title,
}: AddressFormModalProps) {
  const [label, setLabel] = useState<AddressLabel>("Shop");
  const [customLabel, setCustomLabel] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [gstin, setGstin] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [landmark, setLandmark] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState<string>("Maharashtra");
  const [pincode, setPincode] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      const knownLabel = ADDRESS_LABELS.includes(initialData.label as any)
        ? (initialData.label as AddressLabel)
        : "Other";
      setLabel(knownLabel);
      if (knownLabel === "Other" && !ADDRESS_LABELS.includes(initialData.label as any)) {
        setCustomLabel(initialData.label);
      } else {
        setCustomLabel("");
      }

      setFullName(initialData.full_name || "");
      setPhone(initialData.phone ? cleanIndianMobile(initialData.phone) : "");
      setBusinessName(initialData.business_name || "");
      setGstin(initialData.gstin || "");
      setLine1(initialData.line1 || "");
      setLine2(initialData.line2 || "");
      setLandmark(initialData.landmark || "");
      setCity(initialData.city || "");
      setState(initialData.state || "Maharashtra");
      setPincode(initialData.pincode || "");
      setIsDefault(Boolean(initialData.is_default));
    } else {
      // New address defaults
      setLabel("Shop");
      setCustomLabel("");
      setFullName("");
      setPhone("");
      setBusinessName("");
      setGstin("");
      setLine1("");
      setLine2("");
      setLandmark("");
      setCity("");
      setState("Maharashtra");
      setPincode("");
      setIsDefault(false);
    }
    setErrors({});
    setSubmitError(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  function validate(): boolean {
    const errs: Record<string, string> = {};

    if (!fullName.trim()) errs.fullName = "Contact person name is required";

    const cleanPh = cleanIndianMobile(phone);
    if (!cleanPh) {
      errs.phone = "Mobile number is required";
    } else if (!isValidIndianMobile(cleanPh)) {
      errs.phone = "Enter a valid 10-digit Indian mobile number";
    }

    if (!line1.trim()) errs.line1 = "Address line 1 is required";
    if (!city.trim()) errs.city = "City / District is required";
    if (!state.trim()) errs.state = "Please select a state";

    const cleanPin = cleanPincode(pincode);
    if (!cleanPin) {
      errs.pincode = "Pincode is required";
    } else if (!isValidPincode(cleanPin)) {
      errs.pincode = "Enter a valid 6-digit Indian PIN code";
    }

    if (gstin.trim() && !isValidGSTIN(gstin.trim())) {
      errs.gstin = "Invalid 15-character GSTIN format";
    }

    if (label === "Other" && customLabel.trim() && customLabel.length > 25) {
      errs.customLabel = "Label must be 25 characters or less";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    triggerHaptic("selection");

    if (!validate()) {
      triggerHaptic("heavy");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const chosenLabel =
      label === "Other" && customLabel.trim() ? customLabel.trim() : label;

    const payload: CreateAddressInput = {
      label: chosenLabel,
      full_name: fullName.trim(),
      phone: cleanIndianMobile(phone),
      business_name: businessName.trim() || null,
      gstin: gstin.trim() ? gstin.trim().toUpperCase() : null,
      line1: line1.trim(),
      line2: line2.trim() || null,
      landmark: landmark.trim() || null,
      city: city.trim(),
      state: state.trim(),
      pincode: cleanPincode(pincode),
      is_default: isDefault,
    };

    try {
      await onSave(payload);
      triggerHaptic("success");
      onClose();
    } catch (err: unknown) {
      triggerHaptic("heavy");
      const e = err as Error;
      setSubmitError(e.message || "Failed to save address");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 dark:bg-black/80 backdrop-blur-xs animate-in fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full sm:max-w-xl bg-white dark:bg-slate-900 rounded-t-4xl sm:rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 max-h-[92vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
        {/* Mobile handle */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full" />
        </div>

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-orange-500/15 text-brand-dark dark:text-orange-400 flex items-center justify-center shrink-0">
              <MapPin className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                {title || (initialData ? "Edit Saved Address" : "Add New Delivery Address")}
              </h2>
              <p className="text-[11px] text-slate-400 dark:text-slate-400 font-medium">
                Dispatch location &amp; consignment receiver
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white cursor-pointer transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {submitError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{submitError}</span>
            </div>
          )}

          <form id="address-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Label Chips Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                Address Type / Label
              </label>
              <div className="flex flex-wrap gap-2">
                {ADDRESS_LABELS.map((lbl) => {
                  const isSelected = label === lbl;
                  return (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => {
                        triggerHaptic("selection");
                        setLabel(lbl);
                      }}
                      style={{
                        background: isSelected ? "var(--brand-gradient)" : undefined,
                        boxShadow: isSelected ? "var(--brand-shadow)" : undefined,
                      }}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? "text-white scale-102"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700 border border-transparent dark:border-slate-700/60"
                      }`}
                    >
                      {lbl}
                    </button>
                  );
                })}
              </div>

              {label === "Other" && (
                <div className="mt-2.5">
                  <input
                    type="text"
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    placeholder="e.g. Branch 2, Depot, Service Center"
                    maxLength={25}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-brand-dark dark:focus:border-brand focus:bg-white dark:focus:bg-slate-800 transition"
                  />
                  {errors.customLabel && (
                    <p className="text-[10px] text-rose-500 mt-1">{errors.customLabel}</p>
                  )}
                </div>
              )}
            </div>

            {/* Contact Person & Mobile */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Contact Person Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (errors.fullName) setErrors((p) => ({ ...p, fullName: "" }));
                    }}
                    placeholder="Receiver's name"
                    className={`w-full pl-10 pr-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border rounded-xl outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:border-brand-dark dark:focus:border-brand transition ${
                      errors.fullName
                        ? "border-rose-400 dark:border-rose-600 bg-rose-50/20 dark:bg-rose-950/20"
                        : "border-slate-200 dark:border-slate-700"
                    }`}
                  />
                </div>
                {errors.fullName && (
                  <p className="text-[10px] text-rose-500 mt-1">{errors.fullName}</p>
                )}
              </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Contact Phone (10 digits) <span className="text-rose-500">*</span>
              </label>
              <div className="relative flex">
                <span className="inline-flex items-center px-2.5 text-xs font-bold bg-slate-100 dark:bg-slate-750 text-slate-500 dark:text-slate-300 border border-r-0 border-slate-200 dark:border-slate-700 rounded-l-xl">
                  +91
                </span>
                <input
                  type="tel"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value.replace(/\D/g, ""));
                    if (errors.phone) setErrors((p) => ({ ...p, phone: "" }));
                  }}
                  placeholder="9876543210"
                  className={`w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border rounded-r-xl outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:border-brand-dark dark:focus:border-brand transition ${
                    errors.phone
                      ? "border-rose-400 dark:border-rose-600 bg-rose-50/20 dark:bg-rose-950/20"
                      : "border-slate-200 dark:border-slate-700"
                  }`}
                />
              </div>
              {errors.phone && (
                <p className="text-[10px] text-rose-500 mt-1">{errors.phone}</p>
              )}
            </div>
            </div>

            {/* Optional Business Name & GSTIN */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Business / Store Name <span className="text-slate-400 dark:text-slate-500 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Shop or company name"
                    className="w-full pl-10 pr-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:border-brand-dark dark:focus:border-brand transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  GSTIN <span className="text-slate-400 dark:text-slate-500 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <FileCheck2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    maxLength={15}
                    value={gstin}
                    onChange={(e) => {
                      setGstin(e.target.value.toUpperCase());
                      if (errors.gstin) setErrors((p) => ({ ...p, gstin: "" }));
                    }}
                    placeholder="27AAPFU0939F1ZV"
                    className={`w-full pl-10 pr-3.5 py-2 text-xs font-mono uppercase bg-slate-50 dark:bg-slate-800/80 border rounded-xl outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:border-brand-dark dark:focus:border-brand transition ${
                      errors.gstin
                        ? "border-rose-400 dark:border-rose-600 bg-rose-50/20 dark:bg-rose-950/20"
                        : "border-slate-200 dark:border-slate-700"
                    }`}
                  />
                </div>
                {errors.gstin && (
                  <p className="text-[10px] text-rose-500 mt-1">{errors.gstin}</p>
                )}
              </div>
            </div>

            {/* Address Line 1 */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Address Line 1 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={line1}
                onChange={(e) => {
                  setLine1(e.target.value);
                  if (errors.line1) setErrors((p) => ({ ...p, line1: "" }));
                }}
                placeholder="Shop No. 12, Ground Floor, Sai Plaza"
                className={`w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border rounded-xl outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:border-brand-dark dark:focus:border-brand transition ${
                  errors.line1
                    ? "border-rose-400 dark:border-rose-600 bg-rose-50/20 dark:bg-rose-950/20"
                    : "border-slate-200 dark:border-slate-700"
                }`}
              />
              {errors.line1 && (
                <p className="text-[10px] text-rose-500 mt-1">{errors.line1}</p>
              )}
            </div>

            {/* Address Line 2 & Landmark */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Address Line 2 <span className="text-slate-400 dark:text-slate-500 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={line2}
                  onChange={(e) => setLine2(e.target.value)}
                  placeholder="Market Road, Sector 17"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:border-brand-dark dark:focus:border-brand transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Landmark <span className="text-slate-400 dark:text-slate-500 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <Navigation className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    placeholder="Near Metro Gate 2"
                    className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:border-brand-dark dark:focus:border-brand transition"
                  />
                </div>
              </div>
            </div>

            {/* City, State & Pincode */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  City / District <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                    if (errors.city) setErrors((p) => ({ ...p, city: "" }));
                  }}
                  placeholder="Mumbai"
                  className={`w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border rounded-xl outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:border-brand-dark dark:focus:border-brand transition ${
                    errors.city
                      ? "border-rose-400 dark:border-rose-600 bg-rose-50/20 dark:bg-rose-950/20"
                      : "border-slate-200 dark:border-slate-700"
                  }`}
                />
                {errors.city && (
                  <p className="text-[10px] text-rose-500 mt-1">{errors.city}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  State / UT <span className="text-rose-500">*</span>
                </label>
                <select
                  value={state}
                  onChange={(e) => {
                    setState(e.target.value);
                    if (errors.state) setErrors((p) => ({ ...p, state: "" }));
                  }}
                  className={`w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border rounded-xl outline-none text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-brand-dark dark:focus:border-brand transition ${
                    errors.state
                      ? "border-rose-400 dark:border-rose-600 bg-rose-50/20 dark:bg-rose-950/20"
                      : "border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                      {s}
                    </option>
                  ))}
                </select>
                {errors.state && (
                  <p className="text-[10px] text-rose-500 mt-1">{errors.state}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  PIN Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => {
                    setPincode(e.target.value.replace(/\D/g, ""));
                    if (errors.pincode) setErrors((p) => ({ ...p, pincode: "" }));
                  }}
                  placeholder="400001"
                  className={`w-full px-3.5 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800/80 border rounded-xl outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:border-brand-dark dark:focus:border-brand transition ${
                    errors.pincode
                      ? "border-rose-400 dark:border-rose-600 bg-rose-50/20 dark:bg-rose-950/20"
                      : "border-slate-200 dark:border-slate-700"
                  }`}
                />
                {errors.pincode && (
                  <p className="text-[10px] text-rose-500 mt-1">{errors.pincode}</p>
                )}
              </div>
            </div>

            {/* Set as Default Checkbox */}
            <div className="pt-1">
              <label className="inline-flex items-center space-x-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => {
                    triggerHaptic("selection");
                    setIsDefault(e.target.checked);
                  }}
                  className="w-4 h-4 rounded text-orange-500 focus:ring-orange-400 border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 cursor-pointer accent-orange-500"
                />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Set as default delivery address for checkout
                </span>
              </label>
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-2.5 bg-slate-50/50 dark:bg-slate-900/60">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="address-form"
            disabled={submitting}
            style={{
              background: "var(--brand-gradient)",
              boxShadow: "var(--brand-shadow)",
            }}
            className="px-5 py-2.5 rounded-xl text-white font-black text-xs transition active:scale-[0.98] shadow-sm cursor-pointer disabled:opacity-60 flex items-center space-x-1.5"
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            <span>{submitting ? "Saving..." : initialData ? "Save Changes" : "Save Address"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
