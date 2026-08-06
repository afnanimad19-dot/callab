import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#07090f",
          900: "#0b0e17",
          850: "#10141f",
          800: "#151a29",
          700: "#1e2537",
          600: "#2a3349",
          500: "#3d4763",
          400: "#6b7694",
          300: "#98a2be",
          200: "#c3cade",
          100: "#e4e8f2",
        },
        accent: {
          300: "#8be9c3",
          400: "#4fd8a4",
          500: "#22c58b",
          600: "#16a374",
          700: "#0f815d",
        },
        signal: {
          amber: "#f5b453",
          red: "#f0645c",
          blue: "#5ca8f0",
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
