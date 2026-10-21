export type AddressLabel = "Shop" | "Warehouse" | "Home" | "Other" | string;

export interface Address {
  id: string;
  user_id: string;
  label: AddressLabel;
  full_name: string; // Contact person name
  phone: string;
  business_name?: string | null;
  gstin?: string | null;
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateAddressInput {
  label: AddressLabel;
  full_name: string;
  phone: string;
  business_name?: string | null;
  gstin?: string | null;
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  city: string;
  state: string;
  pincode: string;
  is_default?: boolean;
}

export type UpdateAddressInput = Partial<CreateAddressInput>;
