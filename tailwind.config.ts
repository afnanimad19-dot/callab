import type { Config } from "tailwindcss";

// Light theme with purple accent. The "ink" scale is ordered by *surface depth*
// (950 = page background … 100 = primary text), so components reference roles,
// not literal colors — retheming means editing only this file.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#f6f5fa", // page background
          900: "#ffffff", // raised surface
          850: "#ffffff", // card background
          800: "#f3f1fa", // subtle fill / hover
          700: "#e8e5f3", // borders
          600: "#d9d4ea", // strong borders
          500: "#a49fbd", // placeholders
          400: "#7c7691", // muted text
          300: "#5b5570", // secondary text
          200: "#38334d", // strong text
          100: "#191527", // primary text
        },
        accent: {
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#7c3aed",
          600: "#6d28d9",
          700: "#5b21b6",
        },
        signal: {
          amber: "#d97706",
          red: "#dc2626",
          blue: "#2563eb",
        },
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
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
          "0%, 100%": { transform: "scaleY(0.4)" },
          "50%": { transform: "scaleY(1)" },
        },
      },
      animation: {
        pulseDot: "pulseDot 1.6s ease-in-out infinite",
        rise: "rise 0.6s ease-out both",
        wave: "wave 1.1s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
