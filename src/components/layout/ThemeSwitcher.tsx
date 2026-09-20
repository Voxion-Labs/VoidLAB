"use client";

import { Palette } from "lucide-react";
import { ThemeName, useTheme } from "@/context/ThemeContext";

const labels: Record<ThemeName, string> = {
  "light-red": "Fade white",
  "black-red": "Rich black",
};

export default function ThemeSwitcher() {
  const { setTheme, theme } = useTheme();

  return (
    <label className="theme-control inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm theme-text">
      <Palette size={15} className="theme-muted-strong" />
      <select
        className="bg-transparent outline-none"
        onChange={(event) => setTheme(event.target.value as ThemeName)}
        value={theme}
      >
        {Object.entries(labels).map(([value, label]) => (
          <option key={value} value={value} className="theme-text-strong" style={{ background: "var(--panel-background)" }}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
