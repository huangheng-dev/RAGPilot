"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemeMode = "light" | "dark";

type PreferencesContextValue = {
  isReady: boolean;
  themeMode: ThemeMode;
  setThemeMode: (themeMode: ThemeMode) => void;
  toggleThemeMode: () => void;
};

const THEME_STORAGE_KEY = "ragpilot-theme";

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const nextThemeMode: ThemeMode =
      storedTheme === "dark" || storedTheme === "light" ? storedTheme : prefersDark ? "dark" : "light";

    setThemeMode(nextThemeMode);
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    document.documentElement.classList.toggle("dark", themeMode === "dark");
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [isReady, themeMode]);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      isReady,
      themeMode,
      setThemeMode,
      toggleThemeMode: () => setThemeMode((currentValue) => (currentValue === "dark" ? "light" : "dark"))
    }),
    [isReady, themeMode]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used within PreferencesProvider.");
  }

  return context;
}
