"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useState } from "react";
import { isTheme, LEGACY_THEME_STORAGE_KEY, THEME_STORAGE_KEY } from "app/lib/theme";

const ThemeContext = createContext(null);

function readStoredValue(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readThemePreference() {
  const value = readStoredValue(THEME_STORAGE_KEY);
  if (isTheme(value)) return value;
  const legacy = readStoredValue(LEGACY_THEME_STORAGE_KEY);
  if (legacy === "true") return "dark";
  if (legacy === "false") return "light";
  return null;
}

function storePreference(value) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, value);
  } catch {
    // The switch still works for this visit in browsers that block storage.
  }
}

export function ThemeProvider({ children }) {
  // null = no explicit choice, so the page follows the OS setting live.
  const [preference, setPreference] = useState(null);
  const [systemTheme, setSystemTheme] = useState("light");
  const [ready, setReady] = useState(false);
  const theme = preference ?? systemTheme;

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystem = () => setSystemTheme(media.matches ? "dark" : "light");
    const syncStorage = (event) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) {
        setPreference(readThemePreference());
      }
    };
    setPreference(readThemePreference());
    syncSystem();
    setReady(true);
    media.addEventListener("change", syncSystem);
    window.addEventListener("storage", syncStorage);
    return () => {
      media.removeEventListener("change", syncSystem);
      window.removeEventListener("storage", syncStorage);
    };
  }, []);

  useLayoutEffect(() => {
    if (ready) document.documentElement.dataset.theme = theme;
  }, [ready, theme]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setPreference(next);
    storePreference(next);
  }

  return (
    <ThemeContext.Provider value={{ theme, ready, toggleTheme }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
