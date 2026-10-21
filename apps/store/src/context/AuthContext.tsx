import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { Profile } from "@urbanrat/shared";
import { cleanIndianMobile } from "@urbanrat/shared";

export interface SignUpData {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  businessName?: string;
  gstin?: string;
}

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (data: SignUpData) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfile: (updates: {
    fullName?: string;
    phone?: string;
    businessName?: string | null;
    gstin?: string | null;
  }) => Promise<Profile>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (!error && data) {
        setProfile(data as Profile);
      }
    } catch (err) {
      console.error("[AuthContext] Profile fetch error:", err);
    }
  }, []);

  useEffect(() => {
    // 1. Initial session check
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      if (initialSession?.user) {
        fetchProfile(initialSession.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // 2. Auth state subscription
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (currentSession?.user) {
        await fetchProfile(currentSession.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;
  };

  const signUp = async (data: SignUpData) => {
    const cleanedPhone = cleanIndianMobile(data.phone);
    const cleanedGstin = data.gstin ? data.gstin.trim().toUpperCase() : undefined;

    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email.trim(),
      password: data.password,
      options: {
        data: {
          full_name: data.fullName.trim(),
          phone: cleanedPhone,
          business_name: data.businessName?.trim() || null,
          gstin: cleanedGstin || null,
        },
      },
    });

    if (error) throw error;

    // Check if email confirmation is required (session will be null if email confirm is on)
    const needsConfirmation = !authData.session;
    return { needsConfirmation };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setProfile(null);
    setSession(null);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/account?action=reset-password`,
    });
    if (error) throw error;
  };

  const updateProfile = async (updates: {
    fullName?: string;
    phone?: string;
    businessName?: string | null;
    gstin?: string | null;
  }) => {
    if (!user) throw new Error("User must be logged in to update profile");

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.fullName !== undefined) patch.full_name = updates.fullName.trim();
    if (updates.phone !== undefined) patch.phone = cleanIndianMobile(updates.phone);
    if (updates.businessName !== undefined) {
      patch.business_name = updates.businessName?.trim() || null;
    }
    if (updates.gstin !== undefined) {
      patch.gstin = updates.gstin ? updates.gstin.trim().toUpperCase() : null;
    }

    const { data, error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", user.id)
      .select()
      .single();

    if (error) throw error;
    const updated = data as Profile;
    setProfile(updated);
    return updated;
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updateProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
