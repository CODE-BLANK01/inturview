import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Light parchment palette — beige canvas, warm whites for panels,
        // deep brown text, olive green accent.
        bg: { DEFAULT: "#f5efe0", elevated: "#fdf8ea", surface: "#ede4c8" },
        border: { DEFAULT: "#d4c9a8", strong: "#bfb088" },
        text: { DEFAULT: "#3a2e1c", muted: "#6b5c3f", dim: "#9a8a68" },
        accent: { DEFAULT: "#6b8939", hover: "#7ea047" },
        easy: "#5d8c2d",
        medium: "#a87826",
        hard: "#9a3f2a",
        hire: { strong: "#5d8c2d", normal: "#6b8939", no: "#9a3f2a" },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
