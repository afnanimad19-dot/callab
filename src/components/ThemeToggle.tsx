"use client";

// Sun/moon toggle. Dark is the default; the choice persists in localStorage
// and is applied before hydration by the inline script in app/layout.tsx.

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    if (current === "light") setTheme("light");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (next === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    try {
      localStorage.setItem("theme", next);
    } catch {
      // private mode etc. — toggle still works for this page view
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-ink-600 bg-ink-850 text-base transition hover:border-accent-500/50 hover:bg-ink-800"
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
