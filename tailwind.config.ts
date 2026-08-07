import type { Config } from "tailwindcss";

// Dark theme with a violet→fuchsia→orange gradient accent.
// The "ink" scale is ordered by *surface depth* (950 = page background …
// 100 = primary text), so components reference roles, not literal colors —
// retheming the whole app means editing only this file.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Role-based surface scale backed by CSS variables (see globals.css):
        // dark by default, flipped to light by [data-theme="light"] on <html>.
        ink: {
          950: "rgb(var(--ink-950) / <alpha-value>)", // page background
          900: "rgb(var(--ink-900) / <alpha-value>)", // raised surface
          850: "rgb(var(--ink-850) / <alpha-value>)", // card background
          800: "rgb(var(--ink-800) / <alpha-value>)", // subtle fill / hover
          700: "rgb(var(--ink-700) / <alpha-value>)", // borders
          600: "rgb(var(--ink-600) / <alpha-value>)", // strong borders
          500: "rgb(var(--ink-500) / <alpha-value>)", // placeholders
          400: "rgb(var(--ink-400) / <alpha-value>)", // muted text
          300: "rgb(var(--ink-300) / <alpha-value>)", // secondary text
          200: "rgb(var(--ink-200) / <alpha-value>)", // strong text
          100: "rgb(var(--ink-100) / <alpha-value>)", // primary text
        },
        accent: {
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
        },
        glow: {
          pink: "#d946ef",
          orange: "#fb923c",
        },
        signal: {
          amber: "#fbbf24",
          red: "#f87171",
          blue: "#60a5fa",
        },
      },
      fontFamily: {
        sans: [
          "Helvetica Neue",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      keyframes: {
        pulseDot: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
        rise: {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        wave: {
          "0%, 100%": { transform: "scaleY(0.35)" },
          "50%": { transform: "scaleY(1)" },
        },
        orbPulse: {
          "0%, 100%": { transform: "scale(1)", opacity: "0.9" },
          "50%": { transform: "scale(1.06)", opacity: "1" },
        },
      },
      animation: {
        pulseDot: "pulseDot 1.6s ease-in-out infinite",
        rise: "rise 0.6s ease-out both",
        wave: "wave 1.1s ease-in-out infinite",
        orbPulse: "orbPulse 4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
