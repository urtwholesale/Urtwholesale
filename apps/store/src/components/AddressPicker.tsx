import { useState, useEffect, useCallback } from "react";
import type { Address, CreateAddressInput } from "@urbanrat/shared";
import { listAddresses, createAddress } from "../services/addressService";
import { AddressFormModal } from "./AddressFormModal";
import { useAuth } from "../context/AuthContext";
import { triggerHaptic } from "../utils/haptics";
import { formatIndianMobile } from "@urbanrat/shared";
import {
  MapPin,
  Plus,
  CheckCircle2,
  Circle,
  Star,
  Loader2,
  Building2,
} from "lucide-react";

export interface AddressPickerProps {
  selectedAddressId?: string | null;
  onSelectAddress: (address: Address) => void;
  onOpenAuth?: () => void;
}

export function AddressPicker({
  selectedAddressId,
  onSelectAddress,
  onOpenAuth,
}: AddressPickerProps) {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadAddresses = useCallback(async () => {
    if (!user) {
      setAddresses([]);
      return;
    }
    setLoading(true);
    try {
      const data = await listAddresses();
      setAddresses(data);

      // Pre-select default address if none is selected yet
      if (data.length > 0 && !selectedAddressId) {
        const def = data.find((a) => a.is_default) || data[0];
        if (def) {
          onSelectAddress(def);
        }
      }
    } catch (err) {
      console.error("[AddressPicker] Failed to load addresses:", err);
    } finally {
      setLoading(false);
    }
  }, [user, selectedAddressId, onSelectAddress]);

  useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);

  async function handleCreateAddress(input: CreateAddressInput) {
    const created = await createAddress(input);
    setAddresses((prev) => [created, ...prev]);
    onSelectAddress(created);
  }

  // If user is guest/not logged in, offer quick sign-in to access address book
  if (!user) {
    return (
      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-brand-dark shadow-2xs shrink-0">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800">
              Have a saved address?
            </p>
            <p className="text-[11px] text-slate-400">
              Sign in to select your shop or warehouse in 1 tap
            </p>
          </div>
        </div>

        {onOpenAuth && (
          <button
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              onOpenAuth();
            }}
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-white shadow-2xs hover:opacity-95 transition cursor-pointer bg-linear-to-b from-brand-light to-brand-dark"
          >
            Sign In
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 mb-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <MapPin className="w-4 h-4 text-brand-dark" />
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
            Select Delivery Destination
          </h3>
        </div>

        <button
          type="button"
          onClick={() => {
            triggerHaptic("selection");
            setIsModalOpen(true);
          }}
          className="text-xs font-bold text-brand-dark hover:underline flex items-center space-x-1 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Add New Address</span>
        </button>
      </div>

      {loading ? (
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center space-x-2 text-xs text-slate-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-dark" />
          <span>Loading address book...</span>
        </div>
      ) : addresses.length === 0 ? (
        <div className="p-4 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center space-y-2">
          <p className="text-xs text-slate-500 font-medium">
            No saved addresses found in your account
          </p>
          <button
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              setIsModalOpen(true);
            }}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-linear-to-b from-brand-light to-brand-dark cursor-pointer shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add Saved Address</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {addresses.map((addr) => {
            const isSelected = selectedAddressId === addr.id;
            return (
              <div
                key={addr.id}
                onClick={() => {
                  triggerHaptic("selection");
                  onSelectAddress(addr);
                }}
                className={`relative p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between text-left ${
                  isSelected
                    ? "border-brand-dark bg-sky-50/30 ring-1 ring-brand-dark shadow-xs"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center space-x-1.5">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700">
                        {addr.label}
                      </span>
                      {addr.is_default && (
                        <span className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-brand-light/20 text-brand-dark">
                          <Star className="w-2.5 h-2.5 fill-brand-dark text-brand-dark" />
                          <span>Default</span>
                        </span>
                      )}
                    </div>

                    <div className="text-brand-dark">
                      {isSelected ? (
                        <CheckCircle2 className="w-4 h-4 fill-brand-dark text-white" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                  </div>

                  <p className="text-xs font-bold text-slate-900 leading-tight">
                    {addr.full_name}
                    <span className="text-[11px] font-normal text-slate-500 ml-1.5">
                      ({formatIndianMobile(addr.phone)})
                    </span>
                  </p>

                  {addr.business_name && (
                    <p className="text-[11px] text-slate-600 font-medium flex items-center space-x-1 mt-0.5">
                      <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{addr.business_name}</span>
                    </p>
                  )}

                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {addr.line1}
                    {addr.line2 ? `, ${addr.line2}` : ""}, {addr.city}, {addr.state} –{" "}
                    <span className="font-semibold text-slate-700">{addr.pincode}</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Address Form Sheet / Modal */}
      <AddressFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleCreateAddress}
        title="Add Delivery Address"
      />
    </div>
  );
}
