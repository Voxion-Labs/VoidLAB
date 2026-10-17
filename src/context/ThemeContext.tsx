"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type ThemeName = "light" | "dark";

type ThemeContextValue = {
  editorTheme: "light" | "vs-dark";
  setTheme: (theme: ThemeName) => void;
  theme: ThemeName;
};

const storageKey = "voidlab-theme";
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    if (typeof window === "undefined") return "light";
    const stored = window.localStorage.getItem(storageKey) as ThemeName | null;
    // Migrate old theme names
    if (stored === "black-red") return "dark";
    if (stored === "light-red") return "light";
    return stored === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(storageKey, theme);
  }, [theme]);

  const setTheme = (nextTheme: ThemeName) => {
    setThemeState(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem(storageKey, nextTheme);
  };

  const value = useMemo(
    () => ({
      editorTheme: theme === "light" ? ("light" as const) : ("vs-dark" as const),
      setTheme,
      theme,
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
