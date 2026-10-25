import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";
import { cssVariables } from "./lib/theme";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // All color tokens point at CSS variables generated from lib/theme.ts.
        // Values are stored as space-separated RGB triplets so Tailwind's
        // /<alpha> modifier works (e.g. bg-bg/85, text-text-ember/50).
        bg: {
          DEFAULT: "rgb(var(--bg-page) / <alpha-value>)",
          elevated: "rgb(var(--bg-surface) / <alpha-value>)",
          surface: "rgb(var(--bg-inset) / <alpha-value>)",
          inset: "rgb(var(--bg-inset) / <alpha-value>)",
          inverse: "rgb(var(--bg-inverse) / <alpha-value>)",
        },
        border: {
          DEFAULT: "rgb(var(--border-base) / <alpha-value>)",
          strong: "rgb(var(--border-strong) / <alpha-value>)",
        },
        text: {
          DEFAULT: "rgb(var(--text-primary) / <alpha-value>)",
          muted: "rgb(var(--text-secondary) / <alpha-value>)",
          "muted-inverse": "rgb(var(--text-secondary-inverse) / <alpha-value>)",
          dim: "rgb(var(--text-tertiary) / <alpha-value>)",
          ember: "rgb(var(--text-ember) / <alpha-value>)",
          inverse: "rgb(var(--text-inverse) / <alpha-value>)",
          "on-accent": "rgb(var(--text-on-accent) / <alpha-value>)",
        },
        overlay: "rgb(var(--overlay) / <alpha-value>)",
        stage: {
          DEFAULT: "rgb(var(--stage-bg) / <alpha-value>)",
          text: "rgb(var(--stage-text) / <alpha-value>)",
          edge: "rgb(var(--stage-edge) / <alpha-value>)",
        },
        "email-canvas": "rgb(var(--email-canvas) / <alpha-value>)",
        // `accent` aliases ember so existing components inherit the brand color
        // without a sweeping rename. On the landing page the Ember rule applies
        // strictly; inside the product UI it's the primary action color.
        accent: {
          DEFAULT: "rgb(var(--text-ember) / <alpha-value>)",
          hover: "rgb(var(--text-ember) / <alpha-value>)",
        },
        easy: "rgb(var(--score-hire) / <alpha-value>)",
        medium: "rgb(var(--score-maybe) / <alpha-value>)",
        hard: "rgb(var(--score-no) / <alpha-value>)",
        "easy-bg": "rgb(var(--score-hire-bg) / <alpha-value>)",
        "medium-bg": "rgb(var(--score-maybe-bg) / <alpha-value>)",
        "hard-bg": "rgb(var(--score-no-bg) / <alpha-value>)",
        hire: {
          strong: "rgb(var(--score-hire) / <alpha-value>)",
          normal: "rgb(var(--text-ember) / <alpha-value>)",
          no: "rgb(var(--score-no) / <alpha-value>)",
        },
      },
      fontFamily: {
        display: ["Clash Display", "system-ui", "sans-serif"],
        italic: ["Instrument Serif", "Georgia", "serif"],
        sans: ["Cabinet Grotesk", "system-ui", "sans-serif"],
        mono: ["Space Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      letterSpacing: {
        display: "-0.04em",
        headline: "-0.03em",
        eyebrow: "0.13em",
        tight: "-0.01em",
      },
      transitionDuration: {
        150: "150ms",
      },
    },
  },
  // The color variables themselves, light, dark and the public site.
  plugins: [plugin(({ addBase }) => addBase(cssVariables()))],
};

export default config;
