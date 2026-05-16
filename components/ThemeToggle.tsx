"use client";

import { useTheme } from "./ThemeProvider";

/** Text-only theme toggle per the brand brief: Space Mono 10px label, no icon.
 *  The active theme is underlined; clicking the other label switches. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="hidden sm:inline-flex items-center gap-2 text-text-tertiary t-eyebrow">
      <button
        type="button"
        onClick={() => setTheme("light")}
        aria-pressed={theme === "light"}
        className={`transition-colors duration-150 ${
          theme === "light"
            ? "text-text underline underline-offset-4 decoration-1"
            : "hover:text-text-muted"
        }`}
      >
        Light
      </button>
      <span aria-hidden className="text-text-dim">/</span>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        aria-pressed={theme === "dark"}
        className={`transition-colors duration-150 ${
          theme === "dark"
            ? "text-text underline underline-offset-4 decoration-1"
            : "hover:text-text-muted"
        }`}
      >
        Dark
      </button>
    </div>
  );
}
