import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  TRANSLATIONS,
  type SupportedLanguage,
  type Translations,
} from "../locales/translations";
import { triggerHaptic } from "../utils/haptics";

interface LanguageContextValue {
  language: SupportedLanguage;
  isHindi: boolean;
  setLanguage: (lang: SupportedLanguage) => void;
  toggleLanguage: () => void;
  t: (key: string, fallback?: string) => string;
}

const LANGUAGE_STORAGE_KEY = "urt_language";

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined
);

function getInitialLanguage(): SupportedLanguage {
  if (typeof window === "undefined") return "en";

  try {
    const saved = localStorage.getItem(
      LANGUAGE_STORAGE_KEY
    ) as SupportedLanguage | null;
    if (saved === "en" || saved === "hi") {
      return saved;
    }
    // Check browser languages
    if (navigator.language && navigator.language.startsWith("hi")) {
      return "hi";
    }
  } catch {
    // Ignore storage errors
  }

  return "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>(
    getInitialLanguage
  );

  const applyLanguage = useCallback((lang: SupportedLanguage) => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  }, []);

  useEffect(() => {
    applyLanguage(language);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // Ignore
    }
  }, [language, applyLanguage]);

  const setLanguage = useCallback(
    (lang: SupportedLanguage) => {
      triggerHaptic("selection");
      setLanguageState(lang);
    },
    []
  );

  const toggleLanguage = useCallback(() => {
    triggerHaptic("medium");
    setLanguageState((prev) => (prev === "en" ? "hi" : "en"));
  }, []);

  const t = useCallback(
    (key: string, fallback?: string): string => {
      const currentDict: Translations = TRANSLATIONS[language] || TRANSLATIONS.en;
      if (currentDict && key in currentDict) {
        return currentDict[key]!;
      }
      // Fallback to English
      const enDict: Translations = TRANSLATIONS.en;
      if (enDict && key in enDict) {
        return enDict[key]!;
      }
      return fallback ?? key;
    },
    [language]
  );

  const value: LanguageContextValue = {
    language,
    isHindi: language === "hi",
    setLanguage,
    toggleLanguage,
    t,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}

