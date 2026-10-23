import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import type { StoreSettings } from "@urbanrat/shared";
import { getSettings, isSupabaseConfigured } from "../services/storeService";

interface SettingsContextValue {
  settings: StoreSettings | null;
  whatsappNumber: string | null;
  upiId: string;
  storeName: string;
  loading: boolean;
  error: Error | null;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: null,
  whatsappNumber: null,
  upiId: "7000947033-1@okbizaxis",
  storeName: "URT Wholesale",
  loading: true,
  error: null,
  refreshSettings: async () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const loadSettings = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getSettings();
      setSettings(data);
    } catch (err: unknown) {
      console.error("[SettingsContext] Failed to load store settings:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Clean and validate whatsapp_number: must be non-empty string, else null
  const rawNumber = settings?.whatsapp_number?.trim();
  const whatsappNumber = rawNumber && rawNumber.length >= 7 ? rawNumber : null;
  const upiId = settings?.upi_id?.trim() || "7000947033-1@okbizaxis";
  const storeName =
    settings?.store_name?.trim() ||
    settings?.store_info?.name?.trim() ||
    "URT Wholesale";

  return (
    <SettingsContext.Provider
      value={{
        settings,
        whatsappNumber,
        upiId,
        storeName,
        loading,
        error,
        refreshSettings: loadSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext);
}
