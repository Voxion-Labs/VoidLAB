"use client";

import { Moon, Sun } from "lucide-react";
import { ThemeName, useTheme } from "@/context/ThemeContext";

export default function ThemeSwitcher() {
  const { setTheme, theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme((isDark ? "light" : "dark") as ThemeName)}
      className="theme-control inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm theme-text select-none"
    >
      {isDark ? <Sun size={15} className="accent-text" /> : <Moon size={15} className="accent-text" />}
      <span className="hidden sm:inline theme-muted text-xs">
        {isDark ? "Light" : "Dark"}
      </span>
    </button>
  );
}
