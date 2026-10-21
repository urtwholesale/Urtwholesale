export type UserRole = "customer" | "admin";

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  business_name?: string | null;
  gstin?: string | null;
  is_dealer?: boolean;
  created_at: string;
  updated_at?: string;
}
