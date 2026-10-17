"use client";

import { Moon, Sun } from "lucide-react";
import { ThemeName, useTheme } from "@/context/ThemeContext";

export default function ThemeSwitcher() {
  const { setTheme, theme } = useTheme();
  const isDark = theme === "black-red";

  return (
    <button
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(isDark ? "light-red" : "black-red")}
      className="theme-control inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm theme-text select-none"
    >
      {isDark ? (
        <>
          <Sun size={14} className="accent-text" />
          <span className="hidden sm:inline theme-muted">Light</span>
        </>
      ) : (
        <>
          <Moon size={14} className="accent-text" />
          <span className="hidden sm:inline theme-muted">Dark</span>
        </>
      )}
    </button>
  );
}
