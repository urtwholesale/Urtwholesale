import { supabase } from "../lib/supabase";
import type {
  Address,
  CreateAddressInput,
  UpdateAddressInput,
} from "@urbanrat/shared";
import { StoreError } from "./storeService";

/**
 * Fetch all saved delivery addresses for the currently authenticated customer,
 * sorted with the default address first, followed by newest addresses.
 */
export async function listAddresses(): Promise<Address[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("addresses")
    .select("*")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[AddressService] Failed to fetch customer addresses:", error);
    throw new StoreError(error.message, error.code, error.details);
  }

  return (data || []) as Address[];
}

let _supportsExtendedAddressColumns: boolean | null = null;

/**
 * Create a new customer address.
 * If this is the user's first address, it will automatically be marked as default.
 */
export async function createAddress(
  input: CreateAddressInput
): Promise<Address> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new StoreError("You must be logged in to save an address", "UNAUTHENTICATED");
  }

  // Check if user has existing addresses
  const { count } = await supabase
    .from("addresses")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  // If user has zero existing addresses, default should be true
  const shouldBeDefault = count === 0 ? true : Boolean(input.is_default);

  const payload: Record<string, any> = {
    user_id: user.id,
    label: input.label || "Shop",
    full_name: input.full_name.trim(),
    phone: input.phone.trim(),
    line1: input.line1.trim(),
    line2: input.line2?.trim() || null,
    city: input.city.trim(),
    state: input.state.trim(),
    pincode: input.pincode.trim(),
    is_default: shouldBeDefault,
  };

  if (_supportsExtendedAddressColumns !== false) {
    payload.business_name = input.business_name?.trim() || null;
    payload.gstin = input.gstin ? input.gstin.trim().toUpperCase() : null;
    payload.landmark = input.landmark?.trim() || null;
  }

  let { data, error } = await supabase
    .from("addresses")
    .insert([payload])
    .select()
    .single();

  if (
    error &&
    (error.message?.includes("business_name") ||
      error.message?.includes("gstin") ||
      error.message?.includes("landmark") ||
      error.message?.includes("schema cache"))
  ) {
    _supportsExtendedAddressColumns = false;
    const fallbackPayload = { ...payload };
    delete fallbackPayload.business_name;
    delete fallbackPayload.gstin;
    delete fallbackPayload.landmark;

    // Preserve business name and landmark in line2 so information is preserved
    const extras: string[] = [];
    if (input.business_name?.trim()) extras.push(`Biz: ${input.business_name.trim()}`);
    if (input.landmark?.trim()) extras.push(`Near: ${input.landmark.trim()}`);
    if (input.gstin?.trim()) extras.push(`GST: ${input.gstin.trim().toUpperCase()}`);

    if (extras.length > 0) {
      fallbackPayload.line2 = fallbackPayload.line2
        ? `${fallbackPayload.line2} (${extras.join(", ")})`
        : extras.join(", ");
    }

    const retry = await supabase
      .from("addresses")
      .insert([fallbackPayload])
      .select()
      .single();

    data = retry.data;
    error = retry.error;
  } else if (!error) {
    _supportsExtendedAddressColumns = true;
  }

  if (error) {
    console.error("[AddressService] Failed to create address:", error);
    throw new StoreError(error.message, error.code, error.details);
  }

  return data as Address;
}

/**
 * Update an existing customer address.
 */
export async function updateAddress(
  id: string,
  input: UpdateAddressInput
): Promise<Address> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new StoreError("You must be logged in to update an address", "UNAUTHENTICATED");
  }

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.label !== undefined) payload.label = input.label;
  if (input.full_name !== undefined) payload.full_name = input.full_name.trim();
  if (input.phone !== undefined) payload.phone = input.phone.trim();
  if (input.line1 !== undefined) payload.line1 = input.line1.trim();
  if (input.line2 !== undefined) payload.line2 = input.line2?.trim() || null;
  if (input.city !== undefined) payload.city = input.city.trim();
  if (input.state !== undefined) payload.state = input.state.trim();
  if (input.pincode !== undefined) payload.pincode = input.pincode.trim();
  if (input.is_default !== undefined) payload.is_default = input.is_default;

  if (_supportsExtendedAddressColumns !== false) {
    if (input.business_name !== undefined) {
      payload.business_name = input.business_name?.trim() || null;
    }
    if (input.gstin !== undefined) {
      payload.gstin = input.gstin ? input.gstin.trim().toUpperCase() : null;
    }
    if (input.landmark !== undefined) {
      payload.landmark = input.landmark?.trim() || null;
    }
  }

  let { data, error } = await supabase
    .from("addresses")
    .update(payload)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (
    error &&
    (error.message?.includes("business_name") ||
      error.message?.includes("gstin") ||
      error.message?.includes("landmark") ||
      error.message?.includes("schema cache"))
  ) {
    _supportsExtendedAddressColumns = false;
    const fallbackPayload = { ...payload };
    delete fallbackPayload.business_name;
    delete fallbackPayload.gstin;
    delete fallbackPayload.landmark;

    const retry = await supabase
      .from("addresses")
      .update(fallbackPayload)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    data = retry.data;
    error = retry.error;
  } else if (!error) {
    _supportsExtendedAddressColumns = true;
  }

  if (error) {
    console.error("[AddressService] Failed to update address:", error);
    throw new StoreError(error.message, error.code, error.details);
  }

  return data as Address;
}

/**
 * Delete a customer address.
 */
export async function deleteAddress(id: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new StoreError("You must be logged in to delete an address", "UNAUTHENTICATED");
  }

  const { error } = await supabase
    .from("addresses")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("[AddressService] Failed to delete address:", error);
    throw new StoreError(error.message, error.code, error.details);
  }
}

/**
 * Set an address as the customer's primary default address.
 * The backend trigger handle_address_default_toggle automatically un-sets any prior default.
 */
export async function setDefaultAddress(id: string): Promise<Address> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new StoreError("You must be logged in to set a default address", "UNAUTHENTICATED");
  }

  const { data, error } = await supabase
    .from("addresses")
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    console.error("[AddressService] Failed to set default address:", error);
    throw new StoreError(error.message, error.code, error.details);
  }

  return data as Address;
}
